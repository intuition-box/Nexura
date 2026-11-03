"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatEther, parseEther } from "viem";
import StudioLayout from "@/components/studio/StudioLayout";
import StudioLoader from "@/components/studio/StudioLoader";
import CreateNewCampaigns, { TASK_CATALOG, type BuilderState, type CampaignPayment, type PublishedCampaign, type TaskEntry } from "@/components/admin/CreateNewCampaign";
import { useStudioWallet } from "@/components/studio/useStudioWallet";
import { projectApiRequest } from "@/lib/projectApi";
import { createRewardsContract, payStudioHubFee } from "@/lib/performOnchainAction";
import { getNetwork } from "@/lib/runtimeNetwork";
import { useToast } from "@/hooks/use-toast";
import { writeUrlParam } from "@/hooks/use-url-state";
import { useGovernanceProposer } from "@/components/studio/useGovernanceProposer";
import type { ProposalAction } from "@/lib/adminGovernance";

type RewardsDeployment = {
  txHash: string;
  contractAddress: string;
  authorizedAddress: string;
  fundedAmount: string;
  rewardPerParticipant: string;
  maxClaimableParticipants: number;
};

type HubMe = { hub?: { pendingTxHash?: string | null; guildId?: string } };

/**
 * On-chain payments (launch fee + funding the rewards contract).
 * Off until the rewards contract is deployed: the reward step is marked paid locally, campaigns
 * publish without a funded reward pool, and the launch-fee check gets a placeholder reference.
 * Publishing still asks the wallet to sign (see handlePublish).
 */
const PAYMENTS_ENABLED = false;

// New task catalog id → backend campaign-quest tag / category / default link
const TASK_TAG: Record<string, string> = {
  "follow-x": "follow-x",
  "comment-x": "comment-x",
  "retweet-x": "repost-x",
  "like-x": "like",
  "join-discord": "join-discord",
  "discord-msg": "send-message-discord",
  "portal-claims": "i-trust",
  "portal-collab": "i-collaborated",
  "portal-interacted": "i-interact",
  "portal-follow": "i-follow",
  "portal-support": "portal",
  "trust-username": "trust-name",
  "give-feedback": "feedback",
};
const DEFAULT_LINK: Record<string, string> = {
  "i-trust": "https://atlas.box",
  "i-collaborated": "https://atlas.box",
  "i-interact": "https://atlas.box",
  "i-follow": "https://atlas.box",
  "trust-name": "https://tns.intuition.box",
};

function toQuest(task: PublishedCampaign["stages"][number]["tasks"][number], guildId: string, stageKey: string, order: number) {
  const tag = TASK_TAG[task.taskTypeId] ?? "other";
  const isDiscord = tag === "join-discord" || tag === "send-message-discord";
  const isOnchain = tag.startsWith("i-") || tag === "portal" || tag === "trust-name";
  const verificationMode = isOnchain ? "auto"
    : tag === "feedback" ? "feedback"
    : task.validationMode === "api" ? "auto"
    : task.validationMode === "link" ? "link"
    : task.validationMode ? "manual" : "";
  return {
    quest: task.title,
    link: task.taskUrl || DEFAULT_LINK[tag] || "https://nexura.io",
    tag,
    category: tag.endsWith("-x") || tag === "like" ? "twitter" : isDiscord ? "discord" : "other",
    verificationMode,
    // Retention builder details, so the campaign can be reopened exactly as it was built
    stage: stageKey,
    order,
    points: Number(task.points) || 0,
    taskTypeId: task.taskTypeId,
    // Keeps the saved quest (and its submissions) instead of replacing it
    ...(task.questId ? { _id: task.questId } : {}),
    ...(task.validationMode ? { validationMode: task.validationMode } : {}),
    ...(task.apiEndpoint ? { apiEndpoint: task.apiEndpoint } : {}),
    ...(isDiscord && guildId ? { guildId, metadata: { guildId } } : {}),
  };
}

const DAY_MS = 86_400_000;
const validDate = (v: string) => !!v && !isNaN(new Date(v).getTime());

/** Dates sent with a draft: the real ones when set, otherwise placeholders the server accepts. */
function draftDates(c: PublishedCampaign) {
  const start = validDate(c.startDate) ? new Date(c.startDate) : new Date();
  const end = validDate(c.endDate) ? new Date(c.endDate) : new Date(start.getTime() + 30 * DAY_MS);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

const UNTITLED = "Untitled campaign";

type SavedQuest = { _id: string; quest?: string; link?: string; stage?: string; order?: number; points?: number; taskTypeId?: string; validationMode?: string; apiEndpoint?: string };
type SavedCampaign = {
  _id: string; title?: string; description?: string; status?: string; starts_at?: string; ends_at?: string;
  projectCoverImage?: string; templateId?: string | null; rewardsEnabled?: boolean; maxParticipants?: number;
  reward?: { xp?: number; pool?: number; trustTokens?: number };
  stages?: Array<{ key: string; name: string; returnDays?: number }>;
  builderState?: BuilderState | null;
};

/** ISO date → the builder's local "YYYY-MM-DDTHH:mm". */
function toLocalInput(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const isDefaultLink = (link?: string) => !link || link === "https://nexura.io" || Object.values(DEFAULT_LINK).includes(link);

/** Rebuilds builder state from the stored campaign, for campaigns saved before the builder state was kept. */
function stateFromCampaign(c: SavedCampaign, quests: SavedQuest[]): BuilderState {
  const toTask = (q: SavedQuest, i: number): TaskEntry => {
    const cat = TASK_CATALOG.find(t => t.id === q.taskTypeId) ?? TASK_CATALOG[0];
    return {
      id: `task-${q._id}-${i}`, taskTypeId: cat.id, name: cat.name, category: cat.category,
      points: Number(q.points ?? cat.points) || 0,
      description: q.quest && q.quest !== cat.name ? q.quest : "", subtext: cat.subtext,
      ...(q.validationMode ? { validationMode: q.validationMode as TaskEntry["validationMode"] } : {}),
      ...(q.apiEndpoint ? { apiEndpoint: q.apiEndpoint } : {}),
      ...(!isDefaultLink(q.link) ? { taskUrl: q.link } : {}),
    };
  };
  const byOrder = (a: SavedQuest, b: SavedQuest) => (a.order ?? 0) - (b.order ?? 0);
  const stages: BuilderState["stages"] = (c.stages ?? []).map(st => ({
    id: st.key, name: st.name, returnDays: st.returnDays ?? 0,
    retentionType: (st.returnDays ?? 0) === 0 ? "immediately" : "custom",
    tasks: quests.filter(q => q.stage === st.key).sort(byOrder).map(toTask),
  }));
  // Tasks saved without a stage go into one stage of their own
  const loose = quests.filter(q => !q.stage || !stages.some(st => st.id === q.stage));
  if (loose.length) stages.push({ id: `stage-${c._id}`, name: "Stage 1", returnDays: 0, retentionType: "immediately", tasks: loose.sort(byOrder).map(toTask) });
  return {
    version: 1, step: 2, templateId: c.templateId ?? null, journeyCadence: "weekly", rewardsEnabled: !!c.rewardsEnabled,
    name: c.title && c.title !== UNTITLED ? c.title : "", description: c.description && c.description !== c.title ? c.description : "",
    startDate: toLocalInput(c.starts_at), endDate: toLocalInput(c.ends_at), stages,
    rewardBudget: "", rewardNetwork: "intuition", rewardToken: "TRUST", rewardRecipients: "",
    retentionRequirement: "90", stageAlloc: {}, paidKey: null, paymentTxHash: null,
  };
}

/** Points each task at the quest saved for its stage and position, so saving updates it in place. */
function attachQuestIds(state: BuilderState, quests: SavedQuest[]): BuilderState {
  return {
    ...state,
    stages: state.stages.map(st => ({
      ...st,
      tasks: st.tasks.map((t, i) => {
        const q = quests.find(x => x.stage === st.id && (x.order ?? 0) === i) ?? quests.find(x => x._id && `task-${x._id}-${i}` === t.id);
        return q ? { ...t, questId: q._id } : t;
      }),
    })),
  };
}

/** Whole-wei split: per-participant amount × participants must equal what the contract is funded with. */
function splitPool(pool: number, recipients: number) {
  const poolWei = parseEther(pool.toFixed(18).replace(/\.?0+$/, ""));
  const perWei = poolWei / BigInt(recipients);
  if (perWei <= 0n) throw new Error("The participant pool is too small for that many recipients.");
  return { total: formatEther(perWei * BigInt(recipients)), perParticipant: formatEther(perWei) };
}

export default function Page() {
  const router = useRouter();
  const { toast } = useToast();
  const wallet = useStudioWallet();
  const { propose, sign } = useGovernanceProposer();
  const feeTxHash = useRef<string | null>(null);
  const deployment = useRef<RewardsDeployment | null>(null);
  const draftId = useRef<string | null>(null);
  // Set once published, so a late autosave can't create a second draft
  const published = useRef(false);
  const uploadedCover = useRef<File | null>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  // Reward figures already stored on the campaign; kept as-is unless a new rewards contract is deployed
  const storedReward = useRef<{ xp: number; pool: number; trust: number; maxParticipants: number } | null>(null);
  const storedCover = useRef<string | null>(null);

  // ?edit=<id> reopens a draft where it was left, or a live campaign for editing
  const [loaded, setLoaded] = useState<{ state: BuilderState | null; coverUrl: string | null; live: boolean } | null>(null);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    if (!id) { setLoaded({ state: null, coverUrl: null, live: false }); return; }
    projectApiRequest<{ campaignFound?: SavedCampaign; campaignQuests?: SavedQuest[] }>({ method: "GET", endpoint: "/hub/get-campaign", params: { id } })
      .then(({ campaignFound: c, campaignQuests: quests = [] }) => {
        if (!c) throw new Error("Campaign not found.");
        const live = c.status !== "Save";
        draftId.current = c._id;
        storedReward.current = { xp: c.reward?.xp ?? 0, pool: c.reward?.pool ?? 0, trust: c.reward?.trustTokens ?? 0, maxParticipants: c.maxParticipants ?? 0 };
        const coverUrl = c.projectCoverImage && c.projectCoverImage !== "pending" ? c.projectCoverImage : null;
        storedCover.current = coverUrl;
        let state = c.builderState?.version === 1 ? c.builderState : stateFromCampaign(c, quests);
        // Editing a live campaign starts at its details, with the dates it really has now
        // (an approved end proposal may have moved the end date since the builder last saved)
        if (live) state = { ...state, step: 2, startDate: toLocalInput(c.starts_at) || state.startDate, endDate: toLocalInput(c.ends_at) || state.endDate };
        setLoaded({ state: attachQuestIds(state, quests), coverUrl, live });
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : "The campaign could not be loaded."));
  }, []);

  // The reward contract pays out in the app's native TRUST on Intuition
  const supportedRewards = getNetwork() === "mainnet"
    ? { network: "intuition", token: "TRUST", label: "TRUST on Intuition Mainnet" }
    : { network: "intuition-testnet", token: "tTRUST", label: "tTRUST on Intuition Testnet" };

  /** Pays the studio launch fee once (reusing an unspent payment the hub already has). */
  const ensureLaunchFee = async (): Promise<string> => {
    if (feeTxHash.current) return feeTxHash.current;
    const me = await projectApiRequest<HubMe>({ method: "GET", endpoint: "/hub/me" }).catch(() => null);
    const pending = me?.hub?.pendingTxHash;
    if (pending) { feeTxHash.current = pending; return pending; }
    if (!PAYMENTS_ENABLED) return `payments-disabled-${Date.now()}`;
    if (!wallet.address) { wallet.connect(); throw new Error("Connect your wallet to pay the campaign launch fee, then try again."); }
    const hash = await payStudioHubFee(undefined, undefined, true);
    await projectApiRequest({ method: "PATCH", endpoint: "/hub/save-payment-hash", data: { txHash: hash } });
    feeTxHash.current = hash;
    return hash;
  };

  /** "Pay campaign total": launch fee + deploy and fund the rewards contract with the participant pool. */
  const handlePay = async (p: CampaignPayment): Promise<{ txHash?: string }> => {
    if (p.network !== supportedRewards.network || p.token !== supportedRewards.token) {
      throw new Error(`On-chain reward payouts currently support ${supportedRewards.label} only. Choose that network and token to pay.`);
    }
    if (p.recipients <= 0) throw new Error("Set how many participants can be rewarded.");
    const startMs = new Date(p.startDate).getTime();
    if (isNaN(startMs)) throw new Error("Set the campaign start date first.");

    await ensureLaunchFee();
    if (deployment.current) return { txHash: deployment.current.txHash };

    const { total, perParticipant } = splitPool(p.participantPool, p.recipients);
    const d = await createRewardsContract({
      nameOfCampaign: p.campaignName || "Nexura campaign",
      totalRewards: total,
      rewardToken: perParticipant,
      startDate: Math.floor(startMs / 1000),
    });
    const cap = Number(d.maxClaimableParticipants ?? 0);
    if (!Number.isInteger(cap) || cap !== p.recipients) {
      throw new Error(`Deployment mismatch: the contract allows ${cap} participants, expected ${p.recipients}.`);
    }
    deployment.current = { ...d, maxClaimableParticipants: cap };
    return { txHash: d.txHash };
  };

  /** Saves the campaign and its quests as a draft (status "Save"), creating it on first save. */
  const saveDraft = (c: PublishedCampaign): Promise<string> => {
    const run = async () => {
      const tasks = c.stages.flatMap(s => s.tasks);
      const me = await projectApiRequest<HubMe>({ method: "GET", endpoint: "/hub/me" }).catch(() => null);
      const guildId = me?.hub?.guildId ?? "";
      const d = deployment.current;

      // A draft saves from the first keystroke; until it has a name the server gets a placeholder title
      // (the builder state keeps the real, empty name)
      const title = c.name || UNTITLED;
      const fd = new FormData();
      fd.append("title", title);
      fd.append("description", c.description || title);
      fd.append("nameOfProject", title);
      // The server requires dates on every campaign. Until real ones are picked, a draft gets
      // placeholders (today → +30 days); publishing still requires the real dates.
      const { startISO, endISO } = draftDates(c);
      fd.append("starts_at", startISO);
      fd.append("ends_at", endISO);
      const kept = storedReward.current;
      fd.append("maxParticipants", String(d ? d.maxClaimableParticipants : kept?.maxParticipants ?? 0));
      fd.append("reward", JSON.stringify({
        xp: tasks.reduce((sum, t) => sum + (Number(t.points) || 0), 0),
        pool: d ? Number(d.fundedAmount) : kept?.pool ?? 0,
        trust: d ? Number(d.rewardPerParticipant) : kept?.trust ?? 0,
      }));
      // Upload the cover only when it changed since the last save
      if (c.coverImage && c.coverImage !== uploadedCover.current) fd.append("coverImage", c.coverImage);
      fd.append("isDraft", "true");
      fd.append("campaignQuests", JSON.stringify(c.stages.flatMap(st => st.tasks.map((t, i) => toQuest(t, guildId, st.id, i)))));
      fd.append("stages", JSON.stringify(c.stages.map(st => ({ key: st.id, name: st.name, returnDays: st.returnDays, allocationPct: st.allocationPct }))));
      fd.append("rewardsEnabled", String(c.rewardsEnabled));
      if (c.rewards) fd.append("rewardsConfig", JSON.stringify(c.rewards));
      fd.append("templateId", c.templateId ?? "");
      fd.append("builderState", JSON.stringify(c.builder));

      const saved = await projectApiRequest<{ campaignId?: string }>({
        method: "PATCH", endpoint: "/hub/save-campaign", formData: fd,
        ...(draftId.current ? { params: { id: draftId.current } } : {}),
      });
      const campaignId = saved.campaignId ?? draftId.current;
      if (!campaignId) throw new Error("The campaign could not be saved.");
      draftId.current = campaignId;
      // Once saved, a refresh reopens this draft instead of starting a new campaign
      if (!published.current) writeUrlParam("edit", campaignId);
      if (c.coverImage) uploadedCover.current = c.coverImage;
      return campaignId;
    };
    // Saves run one at a time so autosave and publish never create two drafts
    const next = saveQueue.current.then(run, run);
    saveQueue.current = next.catch(() => {});
    return next;
  };

  /** Autosave: every change is saved, so work survives a closed tab or a shutdown. */
  const handleAutosave = async (c: PublishedCampaign): Promise<"saved" | "skipped"> => {
    if (published.current) return "skipped";
    await saveDraft(c);
    return "saved";
  };

  /** Published campaign: the edits go to Admin Management as a signed proposal, applied when a signer executes it after approval. */
  const handleSaveLive = async (c: PublishedCampaign) => {
    const tasks = c.stages.flatMap(s => s.tasks);
    if (tasks.length === 0) throw new Error("A live campaign needs at least one task.");
    if (!validDate(c.startDate) || !validDate(c.endDate)) throw new Error("Set the campaign start and end dates.");
    const campaignId = draftId.current;
    if (!campaignId) throw new Error("The campaign could not be found. Reopen it from the Campaigns tab.");

    const title = c.name || UNTITLED;
    // Built after the wallet signs, so nothing reaches the server before the signature
    const buildAction = async (): Promise<ProposalAction> => {
      const me = await projectApiRequest<HubMe>({ method: "GET", endpoint: "/hub/me" }).catch(() => null);
      const guildId = me?.hub?.guildId ?? "";
      // A new cover is uploaded now; the proposal carries its URL
      let coverImage: string | undefined;
      if (c.coverImage) {
        const fd = new FormData();
        fd.append("coverImage", c.coverImage);
        coverImage = (await projectApiRequest<{ url: string }>({ method: "POST", endpoint: "/hub/upload-campaign-cover", formData: fd })).url;
      }
      const kept = storedReward.current;
      const changes = {
        title,
        description: c.description || title,
        nameOfProject: title,
        starts_at: new Date(c.startDate).toISOString(),
        ends_at: new Date(c.endDate).toISOString(),
        maxParticipants: kept?.maxParticipants ?? 0,
        reward: { xp: tasks.reduce((sum, t) => sum + (Number(t.points) || 0), 0), pool: kept?.pool ?? 0, trust: kept?.trust ?? 0 },
        campaignQuests: c.stages.flatMap(st => st.tasks.map((t, i) => toQuest(t, guildId, st.id, i))),
        stages: c.stages.map(st => ({ key: st.id, name: st.name, returnDays: st.returnDays, allocationPct: st.allocationPct })),
        rewardsEnabled: c.rewardsEnabled,
        ...(c.rewards ? { rewardsConfig: c.rewards } : {}),
        templateId: c.templateId ?? "",
        builderState: c.builder,
        ...(coverImage ? { coverImage } : {}),
      };
      return { kind: "editCampaign", campaignId, campaignTitle: title, changes };
    };

    let p;
    try {
      p = await propose(`Edit campaign: ${title}`, "Applies the edited details, journey and tasks when executed", buildAction);
    } catch (err) {
      // Campaign edit proposals aren't accepted (404 or an unknown proposal type)
      const status = (err as { status?: number })?.status;
      const msg = err instanceof Error ? err.message : "";
      if ((status === 404 && !/campaign not found/i.test(msg)) || /unknown action/i.test(msg)) {
        throw new Error("Proposing changes isn't available at the moment. Please try again later.");
      }
      throw err;
    }
    toast(p?.status === "executed"
      ? { title: "Changes applied", description: `Approved. ${title} is updated in the app.` }
      : { title: "Proposal sent", description: "Signers can approve it in Admin Management. Once approved, any signer can execute it to apply the changes." });
    router.push("/studio-dashboard/campaigns-tab");
  };

  /** Save draft → attach rewards contract → publish. */
  const handlePublish = async (c: PublishedCampaign) => {
    const tasks = c.stages.flatMap(s => s.tasks);
    if (!c.name) throw new Error("Add a campaign name before publishing.");
    if (tasks.length === 0) throw new Error("Add at least one task before publishing.");
    if (!validDate(c.startDate) || !validDate(c.endDate)) throw new Error("Set the campaign start and end dates before publishing.");
    if (!c.coverImage && !uploadedCover.current && !storedCover.current) throw new Error("Add a cover image before publishing.");
    if (PAYMENTS_ENABLED && c.rewards && !deployment.current) throw new Error("Complete the payment on the Rewards & Funding step before publishing.");

    const txHash = await ensureLaunchFee();
    const campaignId = await saveDraft(c);
    const d = deployment.current;

    if (d) {
      await projectApiRequest({
        method: "PATCH",
        endpoint: "/hub/add-campaign-address",
        data: {
          id: campaignId,
          contractAddress: d.contractAddress,
          deploymentTxHash: d.txHash,
          fundedAmount: Number(d.fundedAmount),
          rewardPerParticipant: Number(d.rewardPerParticipant),
          maxClaimableParticipants: d.maxClaimableParticipants,
          authorizedAddress: d.authorizedAddress,
        },
      });
    }

    // The publishing admin confirms with a wallet signature (no transaction); the server verifies it
    const signed = await sign("Publish", c.name, campaignId);
    await projectApiRequest({ method: "PATCH", endpoint: "/hub/publish-campaign", params: { id: campaignId }, data: { txHash, ...signed } });

    published.current = true;
    feeTxHash.current = null; // the launch fee is spent on this campaign
    deployment.current = null;
    draftId.current = null;
    uploadedCover.current = null;
    storedReward.current = null;
    storedCover.current = null;
    // A start date still ahead means the campaign shows as Upcoming, not live
    const upcoming = new Date(c.startDate).getTime() > Date.now();
    toast({
      title: "Campaign published",
      description: upcoming
        ? `${c.name} is scheduled as Upcoming in the app. Participants can join from ${new Date(c.startDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`
        : `${c.name} is now live in the app.`,
    });
    router.push("/studio-dashboard/campaigns-tab"); // back to the Studio campaigns list
  };

  return (
    <StudioLayout title="Create Campaign" hideHeader>
      {loadError ? (
        <StudioLoader message="" error={loadError} />
      ) : !loaded ? (
        <StudioLoader message="Picking up where you left off…" />
      ) : (
        <CreateNewCampaigns
          initialState={loaded.state}
          initialCoverUrl={loaded.coverUrl}
          mode={loaded.live ? "live" : "create"}
          walletAddress={wallet.address}
          onConnectWallet={wallet.connect}
          onDisconnectWallet={wallet.disconnect}
          onPay={PAYMENTS_ENABLED ? handlePay : undefined}
          onPublish={loaded.live ? handleSaveLive : handlePublish}
          onAutosave={handleAutosave}
        />
      )}
    </StudioLayout>
  );
}
