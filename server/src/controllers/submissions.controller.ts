import mongoose from "mongoose";
import logger from "@/config/logger";
import { hub } from "@/models/hub.model";
import { user } from "@/models/user.model";
import { campaign, campaignCompleted } from "@/models/campaign.model";
import { campaignQuest } from "@/models/quests.model";
import { campaignQuestCompleted } from "@/models/questsCompleted.models";
import { submission } from "@/models/submission.model";
import { parseDate } from "@/utils/dates";
import { buildCampaignStages, computeRetention, scoreCampaignRetention } from "@/utils/retention";
import { BAD_REQUEST, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } from "@/utils/status.utils";
import { nexuraScoreRequirement } from "@/utils/campaignRewards";

/*
 * Studio "Submissions": campaign-first review and analytics.
 *
 * Retention is defined in utils/retention.ts. Only people who claimed the reward are listed.
 */

const PUBLISHED = { $nin: ["Save", "Deleted"] };

/** Which campaigns this admin can see: their hub's, or every hub's for the system hub (as on the Campaigns tab). */
async function campaignScope(hubId: string): Promise<{ filter: Record<string, unknown>; isSystem: boolean } | null> {
  const hubDoc = await hub.findById(hubId).select("systemKey").lean() as any;
  if (!hubDoc) return null;
  const isSystem = hubDoc.systemKey === "nexura-admin-campaigns";
  return { filter: isSystem ? { hub: { $ne: null } } : { hub: hubId }, isSystem };
}

// ─── Fraud hints shown to reviewers ───────────────────────────────────────────
const NEW_ACCOUNT_MS = 7 * 24 * 60 * 60 * 1000;
const X_HOSTS = new Set(["x.com", "twitter.com", "mobile.twitter.com", "mobile.x.com"]);

/** Comparable form of a submitted link: x.com/twitter.com treated alike, no query, hash or trailing slash. */
function normalizeLink(raw: unknown): string {
  const text = String(raw ?? "").trim();
  try {
    const u = new URL(text);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return `${X_HOSTS.has(host) ? "x.com" : host}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return ""; // free text (e.g. feedback) isn't compared
  }
}

/** Author handle of an X post link (x.com/<handle>/status/<id>), lowercase. */
function xHandleOf(raw: unknown): string | null {
  try {
    const u = new URL(String(raw ?? "").trim());
    if (!X_HOSTS.has(u.hostname.replace(/^www\./, "").toLowerCase())) return null;
    const [handle, kind] = u.pathname.split("/").filter(Boolean);
    // x.com/i/status/<id> links don't name the author
    return handle && kind === "status" && handle.toLowerCase() !== "i" ? handle.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Comparable form of any submission: a link (see normalizeLink), or free text such as a survey
 * answer, feedback or a transaction hash, lowercased with spacing and punctuation collapsed.
 * Very short text ("yes", "done") isn't compared, since many people legitimately write it.
 */
function submissionKey(raw: unknown): string {
  const link = normalizeLink(raw);
  if (link) return `link:${link}`;
  const text = String(raw ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return text.length >= 12 ? `text:${text}` : "";
}

const MIN_ANSWER_CHARS = 15;

/** Platform a task's proof should come from, by task tag; null when any link or text is fine. */
function expectedPlatform(tag: string): { label: string; hosts: string[] } | null {
  if (/-x$/.test(tag) || tag === "like") return { label: "an X link", hosts: [...X_HOSTS] };
  if (/discord/.test(tag)) return { label: "a Discord link", hosts: ["discord.com", "discord.gg", "discordapp.com", "ptb.discord.com", "canary.discord.com"] };
  return null;
}

type FraudHint = {
  kind: "duplicate-link" | "duplicate-answer" | "wrong-platform" | "short-answer" | "x-mismatch" | "no-x-linked" | "new-account" | "rejected-before";
  label: string;
};

function fraudHints(s: any, u: any, usersByKey: Map<string, Set<string>>, now: number): FraudHint[] {
  const hints: FraudHint[] = [];
  const raw = String(s.submissionLink ?? "").trim();
  const tag = String(s.taskType ?? "");
  const key = submissionKey(raw);
  const others = key ? (usersByKey.get(key)?.size ?? 1) - 1 : 0;
  if (others > 0) {
    const who = `${others} other ${others === 1 ? "person" : "people"}`;
    hints.push(key.startsWith("link:")
      ? { kind: "duplicate-link", label: `Same link submitted by ${who}` }
      : { kind: "duplicate-answer", label: `Same answer as ${who}` });
  }

  // Proof from the wrong place, e.g. a non-X link for an X task
  const platform = expectedPlatform(tag);
  if (platform) {
    let host = "";
    try { host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); } catch { /* not a link */ }
    if (!platform.hosts.includes(host)) hints.push({ kind: "wrong-platform", label: host ? `Link is on ${host}, expected ${platform.label}` : `Not a link, expected ${platform.label}` });
  } else if (!/^https?:\/\//i.test(raw) && !/^0x[0-9a-f]{8,}$/i.test(raw) && raw.length < MIN_ANSWER_CHARS) {
    // Written answers (surveys, feedback) that say almost nothing
    hints.push({ kind: "short-answer", label: raw ? `Very short answer (${raw.length} characters)` : "Empty answer" });
  }

  // Only comments and quotes are the person's own post, so only those links carry their handle
  const handle = xHandleOf(s.submissionLink);
  const linked = String(u?.socialProfiles?.x?.connected ? u?.socialProfiles?.x?.username ?? "" : "").replace(/^@/, "").toLowerCase();
  const ownPostTask = /comment|quote/i.test(String(s.taskType ?? ""));
  if (handle && ownPostTask) {
    if (!linked) hints.push({ kind: "no-x-linked", label: "No X account linked on Nexura" });
    else if (handle !== linked) hints.push({ kind: "x-mismatch", label: `Posted by @${handle}, linked X is @${linked}` });
  }

  const created = u?.createdAt ? new Date(u.createdAt).getTime() : NaN;
  if (!isNaN(created) && now - created < NEW_ACCOUNT_MS) {
    const days = Math.max(0, Math.floor((now - created) / 86400000));
    hints.push({ kind: "new-account", label: days === 0 ? "Account created today" : `Account ${days} day${days === 1 ? "" : "s"} old` });
  }
  if ((s.rejectedCount ?? 0) > 0) hints.push({ kind: "rejected-before", label: `Rejected ${s.rejectedCount}× before` });
  return hints;
}

/** Live status from the dates, matching the Campaigns tab. */
function liveStatus(c: any): "Active" | "Upcoming" | "Ended" {
  const now = Date.now();
  const starts = parseDate(c.starts_at);
  const ends = parseDate(c.ends_at);
  if (c.status === "Ended" || (ends && ends.getTime() <= now)) return "Ended";
  if (starts && starts.getTime() > now) return "Upcoming";
  return "Active";
}

/** GET /hub/submission-campaigns — the hub's published campaigns with review and participation counts. */
export const getSubmissionCampaigns = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const scope = await campaignScope(String(req.admin.hub));
    if (!scope) {
      res.status(NOT_FOUND).json({ error: "hub not found" });
      return;
    }

    const campaigns = await campaign.find({ ...scope.filter, status: PUBLISHED, deletedAt: null })
      .select("title projectCoverImage starts_at ends_at status participants maxParticipants reward contractAddress")
      .lean() as any[];
    const ids = campaigns.map(c => c._id);

    const quests = await campaignQuest.find({ campaign: { $in: ids } }).select("_id campaign").lean() as any[];
    const campaignByQuest = new Map(quests.map(q => [String(q._id), String(q.campaign)]));

    const subs = await submission.find({ page: "campaign", miniQuestId: { $in: [...campaignByQuest.keys()] } })
      .select("miniQuestId status").lean() as any[];
    const pending = new Map<string, number>();
    const total = new Map<string, number>();
    for (const s of subs) {
      const cid = campaignByQuest.get(String(s.miniQuestId));
      if (!cid) continue;
      total.set(cid, (total.get(cid) ?? 0) + 1);
      if (s.status === "pending") pending.set(cid, (pending.get(cid) ?? 0) + 1);
    }

    const joins = await campaignCompleted.aggregate([
      { $match: { campaign: { $in: ids } } },
      { $group: { _id: "$campaign", joined: { $sum: 1 }, completed: { $sum: { $cond: ["$questsCompleted", 1, 0] } }, claimed: { $sum: { $cond: ["$campaignCompleted", 1, 0] } } } },
    ]);
    const joinsById = new Map(joins.map((j: any) => [String(j._id), j]));

    const order = { Active: 0, Upcoming: 1, Ended: 2 } as const;
    const result = campaigns.map(c => {
      const id = String(c._id);
      const j = joinsById.get(id);
      return {
        _id: id,
        title: c.title,
        projectCoverImage: c.projectCoverImage,
        starts_at: c.starts_at,
        ends_at: c.ends_at,
        status: liveStatus(c),
        hasRewards: !!c.contractAddress && Number(c.reward?.pool ?? 0) > 0,
        participants: j?.joined ?? 0,
        completed: j?.completed ?? 0,
        claimed: j?.claimed ?? 0,
        pendingSubmissions: pending.get(id) ?? 0,
        totalSubmissions: total.get(id) ?? 0,
      };
    }).sort((a, b) => order[a.status] - order[b.status] || b.pendingSubmissions - a.pendingSubmissions);

    res.status(OK).json({ campaigns: result });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Failed to fetch campaigns" });
  }
};

/**
 * GET /hub/campaign-submission-details?id= — one campaign's submissions plus analytics for each
 * person who claimed the reward: campaign retention, Nexura score and stage-by-stage history.
 */
export const getCampaignSubmissionDetails = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = String(req.query.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(BAD_REQUEST).json({ error: "send a valid campaign id" });
      return;
    }
    const scope = await campaignScope(String(req.admin.hub));
    if (!scope) {
      res.status(NOT_FOUND).json({ error: "hub not found" });
      return;
    }
    const c = await campaign.findById(id).lean() as any;
    if (!c || c.deletedAt || c.status === "Deleted") {
      res.status(NOT_FOUND).json({ error: "campaign not found" });
      return;
    }
    if (!scope.isSystem && String(c.hub) !== String(req.admin.hub)) {
      res.status(FORBIDDEN).json({ error: "you are not allowed to view this campaign" });
      return;
    }

    const quests = await campaignQuest.find({ campaign: id }).select("_id quest stage order points tag").lean() as any[];
    const questIds = quests.map(q => q._id);
    const questById = new Map(quests.map(q => [String(q._id), q]));
    const stages = buildCampaignStages(c, quests);

    const [joins, completions, subs] = await Promise.all([
      campaignCompleted.find({ campaign: id }).lean() as Promise<any[]>,
      campaignQuestCompleted.find({ campaignQuest: { $in: questIds }, done: true }).select("user campaignQuest updatedAt").lean() as Promise<any[]>,
      submission.find({ page: "campaign", miniQuestId: { $in: questIds.map(String) } }).sort({ createdAt: -1 }).lean() as Promise<any[]>,
    ]);

    // Only people who claimed the reward are listed; everyone who joined still counts in the stats
    const claims = joins.filter(j => j.campaignCompleted);
    const claimerIds = claims.map(j => String(j.user));
    const userIds = [...new Set([...claimerIds, ...subs.map(s => String(s.user))])].filter(u => mongoose.Types.ObjectId.isValid(u));
    const [users, scores] = await Promise.all([
      user.find({ _id: { $in: userIds } }).select("username address profilePic socialProfiles.x createdAt").lean() as Promise<any[]>,
      computeRetention(claimerIds),
    ]);
    const userById = new Map(users.map(u => [String(u._id), u]));

    // userId → task id → completed at
    const doneByUser = new Map<string, Map<string, number>>();
    for (const d of completions) {
      const uid = String(d.user);
      if (!doneByUser.has(uid)) doneByUser.set(uid, new Map());
      doneByUser.get(uid)!.set(String(d.campaignQuest), new Date(d.updatedAt).getTime());
    }

    const now = Date.now();
    const requirement = nexuraScoreRequirement(c);
    const participants = claims.map(j => {
      const uid = String(j.user);
      const u = userById.get(uid);
      const done = doneByUser.get(uid) ?? new Map<string, number>();
      const score = scoreCampaignRetention(stages, done, new Date(j.createdAt).getTime(), now);
      const o = scores.get(uid);
      return {
        userId: uid,
        username: u?.username ?? "",
        address: u?.address ?? "",
        profilePic: u?.profilePic ?? "",
        joinedAt: new Date(j.createdAt).toISOString(),
        claimedAt: new Date(j.updatedAt).toISOString(),
        tasksDone: quests.filter(q => done.has(String(q._id))).length,
        totalTasks: quests.length,
        stagesCompleted: score.stagesCompleted,
        stagesTotal: score.stagesTotal,
        retentionRate: score.retentionRate,
        nexuraScore: o?.nexuraScore ?? null,
        nexuraScoreCampaigns: o?.campaigns ?? 0,
        // The requirement is on the Nexura score, the same check the reward claim uses
        meetsRequirement: requirement === null ? null : (o?.nexuraScore ?? 0) >= requirement,
        history: score.history,
      };
    }).sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());

    // Grouping: each task's stage and position in the campaign
    const stageOfTask = new Map<string, { index: number; name: string }>();
    stages.forEach((st, index) => st.taskIds.forEach(tid => stageOfTask.set(tid, { index, name: st.name })));

    // Fraud hint: the same link or answer submitted by more than one person in this campaign
    const usersByKey = new Map<string, Set<string>>();
    for (const s of subs) {
      const key = submissionKey(s.submissionLink);
      if (!key) continue;
      if (!usersByKey.has(key)) usersByKey.set(key, new Set());
      usersByKey.get(key)!.add(String(s.user));
    }

    const submissions = subs.map(s => {
      const q = questById.get(String(s.miniQuestId));
      const u = userById.get(String(s.user));
      const stage = stageOfTask.get(String(s.miniQuestId));
      return {
        questId: String(s.miniQuestId),
        stageIndex: stage?.index ?? null,
        stageName: stage?.name ?? "",
        taskOrder: q?.order ?? 0,
        flags: fraudHints(s, u, usersByKey, now),
        _id: String(s._id),
        submissionLink: s.submissionLink,
        page: s.page,
        status: s.status,
        taskType: s.taskType,
        taskTitle: q?.quest ?? "",
        username: s.username || u?.username || "",
        nexuraUsername: u?.username ?? "",
        address: s.address || u?.address || "",
        campaignId: id,
        validatedBy: s.validatedBy ?? "",
        rejectedCount: s.rejectedCount ?? 0,
        user: String(s.user),
        createdAt: s.createdAt,
      };
    });

    const avg = (xs: Array<number | null>) => {
      const v = xs.filter((x): x is number => x !== null);
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    };
    res.status(OK).json({
      campaign: {
        _id: id,
        title: c.title,
        projectCoverImage: c.projectCoverImage,
        starts_at: c.starts_at,
        ends_at: c.ends_at,
        status: liveStatus(c),
        hasRewards: !!c.contractAddress && Number(c.reward?.pool ?? 0) > 0,
        rewardPool: Number(c.reward?.pool ?? 0),
        maxParticipants: Number(c.maxParticipants ?? 0),
        nexuraScoreRequirementPct: requirement,
        stages: stages.map(st => ({ key: st.key, name: st.name, offsetDays: st.offsetDays, totalTasks: st.taskIds.length })),
        totalTasks: quests.length,
      },
      stats: {
        participants: joins.length,
        completedAllTasks: joins.filter(j => j.questsCompleted).length,
        claimedReward: claims.length,
        averageRetention: avg(participants.map(p => p.retentionRate)),
        averageNexuraScore: avg(participants.map(p => p.nexuraScore)),
        meetingRequirement: requirement === null ? null : participants.filter(p => p.meetsRequirement).length,
        pendingSubmissions: submissions.filter(s => s.status === "pending").length,
        approvedSubmissions: submissions.filter(s => s.status === "done").length,
        rejectedSubmissions: submissions.filter(s => s.status === "retry").length,
      },
      participants,
      submissions,
    });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Failed to fetch campaign submissions" });
  }
};
