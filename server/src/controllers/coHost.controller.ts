import mongoose from "mongoose";
import { formatEther, formatUnits, parseEther, parseUnits } from "ethers";
import logger from "@/config/logger";
import { hub } from "@/models/hub.model";
import { campaign } from "@/models/campaign.model";
import { campaignQuest } from "@/models/quests.model";
import { spentPayment } from "@/models/spentPayment.model";
import { STUDIO_CAMPAIGN_FEE, STUDIO_PAYMENTS_ENABLED } from "@/utils/env.utils";
import { BAD_REQUEST, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } from "@/utils/status.utils";
import { validateDiscordTaskConfig } from "@/utils/utils";
import { campaignRewardAsset } from "@/utils/rewardAssets";
import { syncCampaignXp } from "@/utils/campaignXp";
import {
  MAX_CO_HOSTS, feeOnExit, inviteProblem, isInviteExpired, mergeStages, partnerStageKeys,
  partnershipLapsed, readyProblem, rewardShares, splitFee, type Stage,
} from "@/utils/coHosts";

const isObjectId = (v: unknown): v is string => typeof v === "string" && mongoose.Types.ObjectId.isValid(v);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
const MAX_TASKS = 500;
// What a co-host may set on its own tasks; everything else is decided by the server
const TASK_FIELDS = ["_id", "quest", "link", "tag", "category", "verificationMode", "stage", "order", "points", "taskTypeId", "validationMode", "apiEndpoint", "followers", "roleId", "channelId", "feedbackCharLimit"] as const;

class CoHostError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const fail = (res: GlobalResponse, error: unknown, fallback: string) => {
  if (error instanceof CoHostError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  logger.error(error);
  res.status(INTERNAL_SERVER_ERROR).json({ error: fallback });
};

// ─── Fees and rewards ─────────────────────────────────────────────────────────

/** Each partner's share of the launch fee, given how many partners have accepted (the host included). */
export function launchFeeShares(acceptedCoHosts: number) {
  const { host, coHost } = splitFee(parseEther(STUDIO_CAMPAIGN_FEE), 1 + acceptedCoHosts);
  return { host: formatEther(host), coHost: formatEther(coHost), hostWei: host, coHostWei: coHost };
}

/** Smallest launch fee payment accepted when it's saved: one partner's share of a co-hosted launch. */
export const minLaunchFeeShare = () => launchFeeShares(MAX_CO_HOSTS).coHost;

/** The launch fee the host still pays for a campaign: its share once co-hosts have accepted. */
export async function hostLaunchFee(campaignId: unknown): Promise<string> {
  if (!isObjectId(campaignId)) return STUDIO_CAMPAIGN_FEE;
  await lapseStaleCoHosts(campaignId);
  const c = await campaign.findById(campaignId).select("coHosts").lean() as any;
  const accepted = (c?.coHosts ?? []).filter((x: any) => x.status === "accepted").length;
  return launchFeeShares(accepted).host;
}

/** Reward budget in the token's smallest unit, and each partner's share of it from the stages it owns. */
function rewardSplit(c: any) {
  const decimals = Number(campaignRewardAsset(c)?.decimals ?? 18);
  const budget = Number(c.rewardsConfig?.budget ?? 0);
  const budgetWei = budget > 0 ? parseUnits(budget.toFixed(Math.min(decimals, 18)), decimals) : 0n;
  return { decimals, budgetWei, shares: rewardShares(budgetWei, (c.stages ?? []) as Stage[]) };
}

// ─── Partnership upkeep ───────────────────────────────────────────────────────

/** Removes a partner's stages and their tasks from a draft (it left or its partnership lapsed). */
async function dropPartnerStages(campaignId: unknown, hubId: string) {
  const c = await campaign.findById(campaignId).select("stages").lean() as any;
  const keys = (c?.stages ?? []).filter((s: any) => String(s.owner ?? "") === hubId).map((s: any) => String(s.key));
  if (!keys.length) return;
  await campaign.updateOne({ _id: campaignId }, { $pull: { stages: { owner: hubId } } });
  await campaignQuest.deleteMany({ campaign: campaignId, stage: { $in: keys } });
  await campaign.updateOne({ _id: campaignId }, { $set: { noOfQuests: await campaignQuest.countDocuments({ campaign: campaignId }) } });
  await syncCampaignXp(campaignId as any);
}

/**
 * Ends partnerships on drafts where a deadline passed: the co-host never got ready, or the host
 * never launched after it did. The co-host's stages are removed and a held fee becomes refundable.
 * Run before anything reads or acts on co-hosts.
 */
export async function lapseStaleCoHosts(campaignId?: unknown) {
  const scope: Record<string, unknown> = { status: "Save", "coHosts.status": "accepted" };
  if (isObjectId(campaignId)) scope._id = campaignId;
  const drafts = await campaign.find(scope).select("status coHosts").lean() as any[];
  for (const c of drafts) {
    for (const x of c.coHosts ?? []) {
      if (!partnershipLapsed(x, c.status)) continue;
      const updated = await campaign.updateOne(
        { _id: c._id, status: "Save", coHosts: { $elemMatch: { hub: x.hub, status: "accepted" } } },
        { $set: { "coHosts.$.status": "lapsed", "coHosts.$.stageKeys": [], "coHosts.$.feeStatus": feeOnExit(x.feeStatus) } },
      );
      if (updated.modifiedCount) await dropPartnerStages(c._id, String(x.hub));
    }
  }
}

async function hubSummaries(ids: unknown[]) {
  const hubs = await hub.find({ _id: { $in: ids } }).select("name logo").lean() as any[];
  return new Map(hubs.map(h => [String(h._id), { id: String(h._id), name: String(h.name ?? ""), logo: String(h.logo ?? "") }]));
}

async function loadOwnDraft(req: GlobalRequest) {
  const id = req.query.id;
  if (!isObjectId(id)) throw new CoHostError(BAD_REQUEST, "send a valid campaign id");
  await lapseStaleCoHosts(id);
  const c = await campaign.findById(id);
  if (!c || c.deletedAt || String(c.hub) !== String(req.admin.hub)) throw new CoHostError(NOT_FOUND, "campaign not found in your studio");
  return c;
}

/** The draft the caller's studio co-hosts, with its partnership entry. */
async function loadCoHostedDraft(req: GlobalRequest) {
  const id = req.query.id;
  if (!isObjectId(id)) throw new CoHostError(BAD_REQUEST, "send a valid campaign id");
  await lapseStaleCoHosts(id);
  const c = await campaign.findById(id).lean() as any;
  const myHub = String(req.admin.hub);
  const mine = c?.coHosts?.find((x: any) => String(x.hub) === myHub);
  if (!c || c.deletedAt || mine?.status !== "accepted") throw new CoHostError(NOT_FOUND, "your studio isn't co-hosting this campaign");
  return { c, mine, myHub };
}

// ─── Host side ────────────────────────────────────────────────────────────────

/** GET /hub/co-hosts/search?q= — studios by name. */
export const searchCoHostStudios = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const q = String(req.query.q ?? "").trim().slice(0, 60);
    if (q.length < 2) {
      res.status(OK).json({ studios: [] });
      return;
    }
    const studios = await hub.find({ _id: { $ne: req.admin.hub }, systemKey: { $exists: false }, name: { $regex: escapeRegex(q), $options: "i" } })
      .select("name logo").sort({ name: 1 }).limit(8).lean() as any[];
    res.status(OK).json({ studios: studios.map(h => ({ id: String(h._id), name: String(h.name ?? ""), logo: String(h.logo ?? "") })) });
  } catch (error) {
    fail(res, error, "error searching studios");
  }
};

/** GET /hub/campaign-co-hosts?id= */
export const getCampaignCoHosts = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const c = await loadOwnDraft(req);
    const list = (c.coHosts ?? []) as any[];
    const names = await hubSummaries(list.map(x => x.hub));
    const now = Date.now();
    const accepted = list.filter(x => x.status === "accepted").length;
    const fees = launchFeeShares(accepted);
    const { decimals, shares } = rewardSplit(c);
    res.status(OK).json({
      coHosts: list.map(x => ({
        studio: names.get(String(x.hub)) ?? { id: String(x.hub), name: "Unknown studio", logo: "" },
        status: isInviteExpired(x, now) ? "expired" : x.status,
        invitedAt: x.invitedAt,
        respondedAt: x.respondedAt,
        ready: !!x.ready,
        stageKeys: x.stageKeys ?? [],
        rewardShare: formatUnits(shares.get(String(x.hub)) ?? 0n, decimals),
        feeStatus: x.feeStatus ?? "none",
      })),
      launchFee: { total: STUDIO_CAMPAIGN_FEE, host: fees.host, perCoHost: accepted ? fees.coHost : "0" },
      hostRewardShare: formatUnits(shares.get("") ?? 0n, decimals),
    });
  } catch (error) {
    fail(res, error, "error loading co-hosts");
  }
};

/** POST /hub/campaign-co-hosts/invite?id= { studioId } */
export const inviteCoHost = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const c = await loadOwnDraft(req);
    const studioId = req.body?.studioId;
    if (!isObjectId(studioId)) throw new CoHostError(BAD_REQUEST, "pick a studio to invite");
    const target = await hub.findById(studioId).select("name systemKey").lean() as any;
    if (!target) throw new CoHostError(NOT_FOUND, "studio not found");
    const problem = inviteProblem({ hostHubId: String(c.hub), targetHubId: studioId, campaignStatus: c.status, coHosts: c.coHosts as any, targetIsSystem: !!target.systemKey });
    if (problem) throw new CoHostError(BAD_REQUEST, problem);
    const kept = (c.coHosts as any[]).filter(x => String(x.hub) !== studioId);
    (c as any).coHosts = [...kept, { hub: studioId, status: "invited", invitedBy: req.adminName ?? "", invitedAt: new Date(), stageKeys: [] }];
    await c.save();
    res.status(OK).json({ message: `${target.name} is invited to co-host` });
  } catch (error) {
    fail(res, error, "error inviting the co-host");
  }
};

/** POST /hub/campaign-co-hosts/remove?id= { studioId } — withdraws an invitation that hasn't been accepted. */
export const removeCoHost = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const c = await loadOwnDraft(req);
    if (c.status !== "Save") throw new CoHostError(BAD_REQUEST, "invitations can only be withdrawn while the campaign is a draft");
    const studioId = String(req.body?.studioId ?? "");
    const entry = (c.coHosts as any[]).find(x => String(x.hub) === studioId);
    if (!entry) throw new CoHostError(NOT_FOUND, "that studio isn't a co-host of this campaign");
    if (entry.status === "accepted") throw new CoHostError(BAD_REQUEST, "this studio accepted, so it can't be removed; only its own signers can leave");
    (c as any).coHosts = (c.coHosts as any[]).filter(x => x !== entry);
    await c.save();
    res.status(OK).json({ message: "invitation withdrawn" });
  } catch (error) {
    fail(res, error, "error withdrawing the invitation");
  }
};

// ─── Co-host side ─────────────────────────────────────────────────────────────

/** GET /hub/co-host-invites: campaigns this studio is invited to co-host or co-hosts. */
export const getCoHostInvites = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const myHub = String(req.admin.hub);
    await lapseStaleCoHosts();
    const found = await campaign.find({ "coHosts.hub": myHub, deletedAt: null, status: { $ne: "Deleted" } })
      .select("title hub status starts_at ends_at projectCoverImage stages coHosts rewardsConfig rewardAsset").sort({ updatedAt: -1 }).limit(100).lean() as any[];
    const hosts = await hubSummaries(found.map(c => c.hub));
    const now = Date.now();
    const invites = found.flatMap(c => {
      const mine = (c.coHosts ?? []).find((x: any) => String(x.hub) === myHub);
      const owed = mine?.feeStatus === "refundDue" || mine?.feeStatus === "refunded";
      if (!mine || ((mine.status === "declined" || mine.status === "lapsed") && !owed)) return [];
      const accepted = (c.coHosts ?? []).filter((x: any) => x.status === "accepted").length;
      const { decimals, shares } = rewardSplit(c);
      return [{
        campaignId: String(c._id),
        title: c.title,
        status: c.status,
        startsAt: c.starts_at,
        endsAt: c.ends_at,
        cover: c.projectCoverImage && c.projectCoverImage !== "pending" ? c.projectCoverImage : "",
        host: hosts.get(String(c.hub)) ?? { id: String(c.hub), name: "Unknown studio", logo: "" },
        myStatus: isInviteExpired(mine, now) ? "expired" : mine.status,
        ready: !!mine.ready,
        invitedAt: mine.invitedAt,
        invitedBy: mine.invitedBy,
        myStages: (c.stages ?? []).filter((s: any) => String(s.owner ?? "") === myHub).map((s: any) => String(s.name ?? "")),
        feeStatus: mine.feeStatus ?? "none",
        launchFeeShare: launchFeeShares(mine.status === "accepted" ? accepted : accepted + 1).coHost,
        rewardShare: formatUnits(shares.get(myHub) ?? 0n, decimals),
        rewardToken: c.rewardsConfig?.token ?? "",
      }];
    });
    res.status(OK).json({ invites });
  } catch (error) {
    fail(res, error, "error loading co-host invitations");
  }
};

/** POST /hub/co-host-invites/decline?id= */
export const declineCoHostInvite = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = req.query.id;
    if (!isObjectId(id)) throw new CoHostError(BAD_REQUEST, "send a valid campaign id");
    const updated = await campaign.updateOne(
      { _id: id, status: "Save", coHosts: { $elemMatch: { hub: req.admin.hub, status: "invited" } } },
      { $set: { "coHosts.$.status": "declined", "coHosts.$.respondedAt": new Date() } },
    );
    if (!updated.modifiedCount) throw new CoHostError(NOT_FOUND, "there's no open invitation for your studio on this campaign");
    res.status(OK).json({ message: "invitation declined" });
  } catch (error) {
    fail(res, error, "error declining the invitation");
  }
};

/** GET /hub/co-hosted-campaign?id= — the shared draft as the co-host sees it: everything, but only its own stages are editable. */
export const getCoHostedCampaign = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { c, mine, myHub } = await loadCoHostedDraft(req);
    const [quests, host] = await Promise.all([
      campaignQuest.find({ campaign: c._id }).sort({ order: 1 }).lean(),
      hub.findById(c.hub).select("name logo").lean() as Promise<any>,
    ]);
    const { decimals, shares } = rewardSplit(c);
    const accepted = (c.coHosts ?? []).filter((x: any) => x.status === "accepted").length;
    res.status(OK).json({
      campaign: {
        _id: String(c._id), title: c.title, description: c.description, starts_at: c.starts_at, ends_at: c.ends_at,
        status: c.status, projectCoverImage: c.projectCoverImage, rewardsEnabled: !!c.rewardsEnabled,
        rewardsConfig: c.rewardsConfig ?? null, stages: c.stages ?? [],
      },
      campaignQuests: quests,
      host: { id: String(c.hub), name: String(host?.name ?? ""), logo: String(host?.logo ?? "") },
      me: {
        studioId: myHub, ready: !!mine.ready, readyAt: mine.readyAt,
        rewardShare: formatUnits(shares.get(myHub) ?? 0n, decimals),
        launchFeeShare: launchFeeShares(accepted).coHost,
        feeStatus: mine.feeStatus ?? "none",
      },
    });
  } catch (error) {
    fail(res, error, "error loading the co-hosted campaign");
  }
};

/** PATCH /hub/co-hosted-campaign/stages?id= { stages, campaignQuests } — saves the co-host's own stages and tasks only. */
export const saveCoHostStages = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { c, mine, myHub } = await loadCoHostedDraft(req);
    if (c.status !== "Save") throw new CoHostError(BAD_REQUEST, "the campaign was published, so its stages can't change");
    if (mine.ready) throw new CoHostError(FORBIDDEN, "you marked your stages ready, so they're locked");

    const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);
    let stages: Stage[], quests: any[];
    try { stages = parse(req.body?.stages); quests = parse(req.body?.campaignQuests); } catch { throw new CoHostError(BAD_REQUEST, "the stages or tasks are malformed"); }
    if (!Array.isArray(stages) || !Array.isArray(quests)) throw new CoHostError(BAD_REQUEST, "send the stages and tasks");
    if (quests.length > MAX_TASKS) throw new CoHostError(BAD_REQUEST, "too many tasks");

    const stored = (c.stages ?? []) as Stage[];
    const cleanStages = stages.map(s => ({ key: String(s?.key ?? ""), name: String(s?.name ?? "").slice(0, 120), returnDays: Math.max(0, Number(s?.returnDays) || 0), allocationPct: null }));
    const merged = mergeStages({ stored, incoming: cleanStages.filter(s => s.key), saver: myHub, coHostOrder: (c.coHosts ?? []).map((x: any) => String(x.hub)), hostSetsAllocation: false })
      // The host sets each stage's reward share; a co-host's save keeps what the host set
      .map(s => (s.owner === myHub ? { ...s, allocationPct: stored.find(o => o.key === s.key)?.allocationPct ?? null } : s));
    const myKeys = merged.filter(s => s.owner === myHub).map(s => s.key);

    const myHubDoc = await hub.findById(myHub).select("guildId").lean() as any;
    const cleanQuests = quests
      .map(q => Object.fromEntries(TASK_FIELDS.filter(k => q?.[k] !== undefined).map(k => [k, q[k]])))
      .filter(q => myKeys.includes(String(q.stage ?? "")));
    cleanQuests.forEach((q, i) => {
      const check = validateDiscordTaskConfig(q as any);
      if (!check.success) throw new CoHostError(BAD_REQUEST, `task #${i + 1}: ${check.error}`);
    });

    await campaign.updateOne(
      { _id: c._id, status: "Save", coHosts: { $elemMatch: { hub: myHub, status: "accepted", ready: { $ne: true } } } },
      { $set: { stages: merged, "coHosts.$.stageKeys": myKeys } },
    );
    const { syncCampaignQuests } = await import("@/controllers/hub.controller");
    await syncCampaignQuests(String(c._id), cleanQuests, String(myHubDoc?.guildId ?? ""), partnerStageKeys(merged, myHub));
    await syncCampaignXp(c._id);
    res.status(OK).json({ message: "your stages are saved", stageKeys: myKeys });
  } catch (error) {
    fail(res, error, "error saving your stages");
  }
};

/**
 * POST /hub/co-hosted-campaign/ready?id= — the co-host commits: its stages and the reward settings
 * lock, its reward and fee shares are fixed, and with payments on its fee share is taken and held.
 */
export const markCoHostReady = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { c, mine, myHub } = await loadCoHostedDraft(req);
    if (c.status !== "Save") throw new CoHostError(BAD_REQUEST, "the campaign was already published");
    if (mine.ready) throw new CoHostError(BAD_REQUEST, "your stages are already marked ready");
    const myKeys = (c.stages ?? []).filter((s: any) => String(s.owner ?? "") === myHub).map((s: any) => String(s.key));
    const quests = await campaignQuest.find({ campaign: c._id, stage: { $in: myKeys } }).select("stage tag category").lean() as any[];
    const problem = readyProblem(myKeys, quests);
    if (problem) throw new CoHostError(BAD_REQUEST, problem);

    const hasDiscord = quests.some(q => q.category === "discord" || /discord/.test(String(q.tag ?? "")));
    const myHubDoc = await hub.findById(myHub).select("discordConnected guildId pendingTxHash").lean() as any;
    if (hasDiscord && (!myHubDoc?.discordConnected || !myHubDoc?.guildId)) {
      throw new CoHostError(FORBIDDEN, "connect your studio's Discord before marking stages with Discord tasks ready");
    }

    const accepted = (c.coHosts ?? []).filter((x: any) => x.status === "accepted").length;
    const feeShare = launchFeeShares(accepted).coHostWei;
    const rewardShare = rewardSplit(c).shares.get(myHub) ?? 0n;

    let feeTxHash: string | null = null;
    if (STUDIO_PAYMENTS_ENABLED) {
      const { launchFeeProblem, hubPayerWallets } = await import("@/controllers/studioPayment.controller");
      const txHash: string | null = myHubDoc?.pendingTxHash ?? null;
      const due = formatEther(feeShare);
      const payProblem = await launchFeeProblem(txHash, due, await hubPayerWallets(myHub, req.admin));
      if (payProblem) throw new CoHostError(FORBIDDEN, txHash ? payProblem : `pay your ${due} $TRUST share of the launch fee first`);
      const claimed = await hub.findOneAndUpdate({ _id: myHub, pendingTxHash: txHash }, { $set: { pendingTxHash: null } });
      if (!claimed) throw new CoHostError(BAD_REQUEST, "this payment was just used for something else; pay your share again");
      feeTxHash = txHash;
    }

    const updated = await campaign.updateOne(
      { _id: c._id, status: "Save", coHosts: { $elemMatch: { hub: myHub, status: "accepted", ready: { $ne: true } } } },
      { $set: {
        "coHosts.$.ready": true, "coHosts.$.readyAt": new Date(),
        "coHosts.$.feeShareWei": feeShare.toString(), "coHosts.$.rewardShareWei": rewardShare.toString(),
        "coHosts.$.feeTxHash": feeTxHash, "coHosts.$.feeStatus": feeTxHash ? "held" : "none",
      } },
    );
    if (!updated.modifiedCount) {
      if (feeTxHash) await hub.updateOne({ _id: myHub, pendingTxHash: null }, { $set: { pendingTxHash: feeTxHash } });
      throw new CoHostError(BAD_REQUEST, "the campaign changed while you were marking ready; try again");
    }
    if (feeTxHash) {
      await spentPayment.create({ txHash: feeTxHash.toLowerCase(), hub: myHub, campaign: c._id })
        .catch(err => logger.warn(`co-host payment ${feeTxHash} already recorded: ${err?.message}`));
    }
    if (hasDiscord) {
      await campaignQuest.updateMany({ campaign: c._id, stage: { $in: myKeys }, $or: [{ category: "discord" }, { tag: /discord/ }] }, { $set: { guildId: myHubDoc.guildId } });
    }
    res.status(OK).json({ message: "your stages are ready" });
  } catch (error) {
    fail(res, error, "error marking your stages ready");
  }
};

// ─── Governance (co-host studio's signers) ────────────────────────────────────

/** Validates an "accept co-host invitation" proposal. */
export async function validateAcceptCoHost(hubId: string, raw: any, pending: any[]) {
  const id = typeof raw?.campaignId === "string" ? raw.campaignId : "";
  if (!isObjectId(id)) throw new CoHostError(NOT_FOUND, "campaign not found");
  await lapseStaleCoHosts(id);
  const c = await campaign.findById(id).select("title hub status coHosts deletedAt").lean() as any;
  const mine = c?.coHosts?.find((x: any) => String(x.hub) === hubId);
  if (!c || c.deletedAt || !mine) throw new CoHostError(NOT_FOUND, "there's no invitation for your studio on this campaign");
  if (c.status !== "Save") throw new CoHostError(BAD_REQUEST, "this campaign was already published");
  if (mine.status !== "invited" || isInviteExpired(mine)) throw new CoHostError(BAD_REQUEST, "this invitation is no longer open");
  if (pending.some(p => p.action?.kind === "acceptCoHost" && p.action.campaignId === id)) throw new CoHostError(BAD_REQUEST, "accepting this invitation is already proposed");
  const host = await hub.findById(c.hub).select("name").lean() as any;
  return { kind: "acceptCoHost", campaignId: id, campaignTitle: String(c.title ?? ""), hostName: String(host?.name ?? "") };
}

/** Applies an approved acceptance. Nothing is paid yet: the co-host pays when it marks its stages ready. */
export async function applyAcceptCoHost(hubId: string, action: { campaignId: string }, proposalRef: string) {
  const c = await campaign.findById(action.campaignId).select("status coHosts deletedAt").lean() as any;
  const mine = c?.coHosts?.find((x: any) => String(x.hub) === hubId);
  if (!c || c.deletedAt || !mine) throw new Error("the invitation no longer exists");
  if (c.status !== "Save") throw new Error("the campaign was published before this was accepted");
  if (mine.status !== "invited" || isInviteExpired(mine)) throw new Error("the invitation is no longer open");
  const updated = await campaign.updateOne(
    { _id: action.campaignId, status: "Save", coHosts: { $elemMatch: { hub: hubId, status: "invited" } } },
    { $set: { "coHosts.$.status": "accepted", "coHosts.$.respondedAt": new Date(), "coHosts.$.proposalRef": proposalRef, "coHosts.$.ready": false, "coHosts.$.feeStatus": "none" } },
  );
  if (!updated.modifiedCount) throw new Error("the invitation changed while this was being accepted; try again");
}

/** Validates a "leave co-hosted campaign" proposal. */
export async function validateLeaveCoHost(hubId: string, raw: any, pending: any[]) {
  const id = typeof raw?.campaignId === "string" ? raw.campaignId : "";
  if (!isObjectId(id)) throw new CoHostError(NOT_FOUND, "campaign not found");
  await lapseStaleCoHosts(id);
  const c = await campaign.findById(id).select("title hub status coHosts deletedAt").lean() as any;
  const mine = c?.coHosts?.find((x: any) => String(x.hub) === hubId);
  if (!c || c.deletedAt || mine?.status !== "accepted") throw new CoHostError(NOT_FOUND, "your studio isn't co-hosting this campaign");
  if (c.status !== "Save") throw new CoHostError(BAD_REQUEST, "a published campaign keeps its co-hosts");
  if (pending.some(p => p.action?.kind === "leaveCoHost" && p.action.campaignId === id)) throw new CoHostError(BAD_REQUEST, "leaving this campaign is already proposed");
  const host = await hub.findById(c.hub).select("name").lean() as any;
  return { kind: "leaveCoHost", campaignId: id, campaignTitle: String(c.title ?? ""), hostName: String(host?.name ?? "") };
}

/** Applies an approved "leave": its stages and tasks go, and a held fee becomes refundable since it never launched with them. */
export async function applyLeaveCoHost(hubId: string, action: { campaignId: string }) {
  const c = await campaign.findById(action.campaignId).select("coHosts").lean() as any;
  const mine = c?.coHosts?.find((x: any) => String(x.hub) === hubId);
  const updated = await campaign.updateOne(
    { _id: action.campaignId, status: "Save", coHosts: { $elemMatch: { hub: hubId, status: "accepted" } } },
    { $set: { "coHosts.$.status": "declined", "coHosts.$.respondedAt": new Date(), "coHosts.$.stageKeys": [], "coHosts.$.ready": false, "coHosts.$.feeStatus": feeOnExit(mine?.feeStatus) } },
  );
  if (!updated.modifiedCount) throw new Error("the campaign was published or your studio already left");
  await dropPartnerStages(action.campaignId, hubId);
}

export const governanceErrorStatus = (err: unknown) => (err instanceof CoHostError ? err.status : BAD_REQUEST);

// ─── Nexura team: refunds ─────────────────────────────────────────────────────

/** GET /admin/co-host-refunds: co-host fee shares owed back because their campaign didn't launch with them. */
export const listCoHostRefunds = async (_req: GlobalRequest, res: GlobalResponse) => {
  try {
    await lapseStaleCoHosts();
    const found = await campaign.find({ coHosts: { $elemMatch: { feeStatus: { $in: ["refundDue", "refunded"] } } } })
      .select("title hub coHosts").sort({ updatedAt: -1 }).limit(500).lean() as any[];
    const studios = await hubSummaries(found.flatMap(c => [c.hub, ...(c.coHosts ?? []).map((x: any) => x.hub)]));
    const refunds = found.flatMap(c => (c.coHosts ?? [])
      .filter((x: any) => x.feeStatus === "refundDue" || x.feeStatus === "refunded")
      .map((x: any) => ({
        campaignId: String(c._id),
        campaignTitle: c.title,
        host: studios.get(String(c.hub)) ?? null,
        studio: studios.get(String(x.hub)) ?? null,
        amount: formatEther(BigInt(x.feeShareWei || "0")),
        paymentTxHash: x.feeTxHash,
        status: x.feeStatus,
        refundTxHash: x.refundTxHash,
        refundedAt: x.refundedAt,
        refundedBy: x.refundedBy,
      })));
    res.status(OK).json({ refunds });
  } catch (error) {
    fail(res, error, "error loading co-host refunds");
  }
};

/** POST /admin/co-host-refunds/mark { campaignId, studioId, txHash }: records the refund transaction once it's sent. */
export const markCoHostRefunded = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { campaignId, studioId, txHash } = req.body ?? {};
    if (!isObjectId(campaignId) || !isObjectId(studioId)) throw new CoHostError(BAD_REQUEST, "send the campaign and studio");
    if (typeof txHash !== "string" || !TX_HASH.test(txHash)) throw new CoHostError(BAD_REQUEST, "send the refund transaction hash");
    const updated = await campaign.updateOne(
      { _id: campaignId, coHosts: { $elemMatch: { hub: studioId, feeStatus: "refundDue" } } },
      { $set: { "coHosts.$.feeStatus": "refunded", "coHosts.$.refundTxHash": txHash.toLowerCase(), "coHosts.$.refundedAt": new Date(), "coHosts.$.refundedBy": req.adminName ?? "" } },
    );
    if (!updated.modifiedCount) throw new CoHostError(NOT_FOUND, "there's no refund due for that studio on that campaign");
    res.status(OK).json({ message: "refund recorded" });
  } catch (error) {
    fail(res, error, "error recording the refund");
  }
};
