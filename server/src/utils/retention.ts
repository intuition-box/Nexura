import logger from "@/config/logger";
import { campaign, campaignCompleted } from "@/models/campaign.model";
import { campaignQuest } from "@/models/quests.model";
import { campaignQuestCompleted } from "@/models/questsCompleted.models";
import { user } from "@/models/user.model";
import { parseDate } from "@/utils/dates";

/*
 * Retention: how much of a campaign's journey a person completes.
 *
 * A stage counts once every task in it is done, and it stays counted (retention doesn't expire).
 * Campaign retention = completed stages / all stages, e.g. 3 of 6 stages = 50%.
 * Nexura score = the average of a person's campaign retention across the campaigns that are
 * settled for them: the campaign has ended, or they completed every stage. A campaign still running
 * that they haven't finished doesn't pull their score down yet.
 */

const DAY_MS = 86_400_000;

export type RetentionStage = { key: string; name: string; offsetDays: number; taskIds: string[] };

/** A campaign's stages in order, each with its tasks and when it opens (days after joining). Stages without tasks are left out. */
export function buildCampaignStages(c: { stages?: any[] } | null | undefined, quests: Array<{ _id: unknown; stage?: string | null }>): RetentionStage[] {
  let offset = 0;
  const stages: RetentionStage[] = (c?.stages ?? []).slice()
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    .map((st: any) => {
      offset += Math.max(0, Number(st.returnDays) || 0);
      return { key: String(st.key), name: String(st.name ?? ""), offsetDays: offset, taskIds: [] };
    });
  const byKey = new Map(stages.map(st => [st.key, st]));
  const loose: string[] = [];
  for (const q of quests) {
    const st = q.stage ? byKey.get(String(q.stage)) : undefined;
    if (st) st.taskIds.push(String(q._id)); else loose.push(String(q._id));
  }
  // Tasks saved without a stage count as one stage that opens on joining
  if (loose.length) stages.unshift({ key: "_tasks", name: stages.length ? "Other tasks" : "Tasks", offsetDays: 0, taskIds: loose });
  return stages.filter(st => st.taskIds.length > 0);
}

export type StageResult = {
  key: string; name: string; unlockAt: string; completedAt: string | null; tasksDone: number; totalTasks: number;
  status: "completed" | "in-progress" | "locked";
};

/** Scores one person on one campaign. `done` maps task id → when they completed it (ms). */
export function scoreCampaignRetention(stages: RetentionStage[], done: Map<string, number>, joinedAtMs: number, nowMs = Date.now()) {
  let stagesCompleted = 0;
  const history: StageResult[] = stages.map(st => {
    const times = st.taskIds.map(t => done.get(t));
    const tasksDone = times.filter(t => t !== undefined).length;
    const complete = tasksDone === st.taskIds.length;
    if (complete) stagesCompleted++;
    const unlockAt = joinedAtMs + st.offsetDays * DAY_MS;
    return {
      key: st.key,
      name: st.name,
      unlockAt: new Date(unlockAt).toISOString(),
      completedAt: complete ? new Date(Math.max(...(times as number[]))).toISOString() : null,
      tasksDone,
      totalTasks: st.taskIds.length,
      status: complete ? "completed" : unlockAt <= nowMs ? "in-progress" : "locked",
    };
  });
  const stagesTotal = stages.length;
  return {
    stagesCompleted,
    stagesTotal,
    retentionRate: stagesTotal > 0 ? Math.round((stagesCompleted / stagesTotal) * 100) : null,
    history,
  };
}

/** Nexura score from a person's campaigns: the average over the settled ones (null if none yet). */
export function nexuraScoreFrom(campaigns: Array<{ retentionRate: number | null; settled: boolean }>) {
  const rates = campaigns.filter(c => c.settled && c.retentionRate !== null).map(c => c.retentionRate as number);
  return { nexuraScore: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null, campaigns: rates.length };
}

const isEnded = (c: any, nowMs: number) => {
  const ends = parseDate(c?.ends_at);
  return c?.status === "Ended" || (!!ends && ends.getTime() <= nowMs);
};

export type UserCampaignRetention = { campaignId: string; stagesCompleted: number; stagesTotal: number; retentionRate: number | null; settled: boolean };
export type UserRetention = { nexuraScore: number | null; campaigns: number; perCampaign: Map<string, UserCampaignRetention> };

/** Computes campaign retention and the Nexura score for these people from their task completions. */
export async function computeRetention(userIds: string[], nowMs = Date.now()): Promise<Map<string, UserRetention>> {
  const result = new Map<string, UserRetention>();
  if (userIds.length === 0) return result;

  const joins = await campaignCompleted.find({ user: { $in: userIds } }).select("user campaign createdAt").lean() as any[];
  const campaignIds = [...new Set(joins.map(j => String(j.campaign)).filter(Boolean))];
  const [campaigns, quests] = await Promise.all([
    campaign.find({ _id: { $in: campaignIds } }).select("stages ends_at status").lean() as Promise<any[]>,
    campaignQuest.find({ campaign: { $in: campaignIds } }).select("_id campaign stage").lean() as Promise<any[]>,
  ]);
  const completions = await campaignQuestCompleted.find({ user: { $in: userIds }, campaignQuest: { $in: quests.map(q => q._id) }, done: true })
    .select("user campaignQuest updatedAt").lean() as any[];

  const campaignById = new Map(campaigns.map(c => [String(c._id), c]));
  const questsByCampaign = new Map<string, any[]>();
  for (const q of quests) {
    const cid = String(q.campaign);
    if (!questsByCampaign.has(cid)) questsByCampaign.set(cid, []);
    questsByCampaign.get(cid)!.push(q);
  }
  const stagesByCampaign = new Map(campaignIds.map(cid => [cid, buildCampaignStages(campaignById.get(cid), questsByCampaign.get(cid) ?? [])]));
  const doneByUser = new Map<string, Map<string, number>>();
  for (const d of completions) {
    const uid = String(d.user);
    if (!doneByUser.has(uid)) doneByUser.set(uid, new Map());
    doneByUser.get(uid)!.set(String(d.campaignQuest), new Date(d.updatedAt).getTime());
  }

  for (const uid of userIds) result.set(uid, { nexuraScore: null, campaigns: 0, perCampaign: new Map() });
  for (const j of joins) {
    const uid = String(j.user);
    const cid = String(j.campaign);
    const c = campaignById.get(cid);
    const stages = stagesByCampaign.get(cid) ?? [];
    if (!c || stages.length === 0) continue;
    const score = scoreCampaignRetention(stages, doneByUser.get(uid) ?? new Map(), new Date(j.createdAt).getTime(), nowMs);
    result.get(uid)!.perCampaign.set(cid, {
      campaignId: cid,
      stagesCompleted: score.stagesCompleted,
      stagesTotal: score.stagesTotal,
      retentionRate: score.retentionRate,
      settled: isEnded(c, nowMs) || score.stagesCompleted === score.stagesTotal,
    });
  }
  for (const r of result.values()) Object.assign(r, nexuraScoreFrom([...r.perCampaign.values()]));
  return result;
}

/** Recomputes and stores a person's retention on each campaign they joined, and their Nexura score. Never throws. */
export async function refreshUserRetention(userId: unknown): Promise<void> {
  try {
    const uid = String(userId ?? "");
    if (!uid) return;
    const r = (await computeRetention([uid])).get(uid);
    if (!r) return;
    const writes = [...r.perCampaign.values()].map(pc => ({
      updateOne: {
        filter: { user: uid, campaign: pc.campaignId },
        update: { $set: { stagesCompleted: pc.stagesCompleted, stagesTotal: pc.stagesTotal, retentionRate: pc.retentionRate } },
      },
    }));
    if (writes.length) await campaignCompleted.bulkWrite(writes as any);
    await user.updateOne({ _id: uid }, { $set: { nexuraScore: { rate: r.nexuraScore, campaigns: r.campaigns, updatedAt: new Date() } } });
  } catch (err) {
    logger.error("retention refresh failed:", err);
  }
}
