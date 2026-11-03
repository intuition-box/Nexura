import mongoose from "mongoose";
import logger from "@/config/logger";
import { campaign, campaignCompleted } from "@/models/campaign.model";
import { campaignQuest } from "@/models/quests.model";
import { campaignQuestCompleted } from "@/models/questsCompleted.models";
import { user } from "@/models/user.model";
import { xpLog } from "@/models/xpLog.model";
import { buildCampaignStages, type RetentionStage } from "@/utils/retention";
import { updateLevel } from "@/utils/utils";

/*
 * Fixed XP for campaigns, the same for every hub:
 * - One-time campaign (a single stage): 1,000 XP.
 * - Campaign with retention stages: 2,500 XP in total, split equally across the stages.
 * Each stage's share is paid as soon as the person completes that stage (once it has unlocked for
 * them), so someone who stops part-way keeps what they earned.
 * This applies to every campaign, including those made from the Nexura dashboard.
 */
export const ONE_TIME_CAMPAIGN_XP = 1000;
export const RETENTION_CAMPAIGN_XP = 2500;

const DAY_MS = 86_400_000;

/** XP for each stage, in order. Shares are whole numbers that add up exactly to the total. */
export function stageXpShares(stageCount: number): number[] {
  if (stageCount <= 1) return [ONE_TIME_CAMPAIGN_XP];
  const base = Math.floor(RETENTION_CAMPAIGN_XP / stageCount);
  const extra = RETENTION_CAMPAIGN_XP - base * stageCount;
  return Array.from({ length: stageCount }, (_, i) => base + (i < extra ? 1 : 0));
}

export const campaignXpTotal = (stageCount: number) => stageXpShares(stageCount).reduce((a, b) => a + b, 0);

/** Every campaign uses the fixed XP (Studio hubs and the Nexura dashboard alike). */
export async function usesFixedXp(c: { _id?: unknown } | null | undefined): Promise<boolean> {
  return !!c;
}

async function stagesOf(campaignId: unknown, c?: any): Promise<RetentionStage[]> {
  const doc = c ?? await campaign.findById(campaignId).select("stages hub").lean();
  const quests = await campaignQuest.find({ campaign: campaignId }).select("_id stage").lean() as any[];
  return buildCampaignStages(doc, quests);
}

/**
 * Sets a campaign's advertised XP from its stages (1,000 or 2,500). Call after its tasks or
 * stages change. Never throws.
 */
export async function syncCampaignXp(campaignId: unknown): Promise<void> {
  try {
    const c = await campaign.findById(campaignId).select("hub stages reward").lean() as any;
    if (!c || !(await usesFixedXp(c))) return;
    const total = campaignXpTotal((await stagesOf(campaignId, c)).length);
    if (Number(c.reward?.xp) === total) return;
    await campaign.updateOne({ _id: campaignId }, { $set: { "reward.xp": total, totalXpAvailable: total } });
  } catch (err) {
    logger.error(`syncCampaignXp(${String(campaignId)}) failed: ${(err as any)?.message ?? err}`);
  }
}

/** Brings every campaign to the fixed XP (for campaigns made before this rule). Never throws. */
export async function syncAllCampaignXp(): Promise<void> {
  try {
    const ids = await campaign.find({ deletedAt: null }).select("_id").lean() as any[];
    for (const { _id } of ids) await syncCampaignXp(_id);
    logger.info(`Fixed campaign XP checked on ${ids.length} campaigns`);
  } catch (err) {
    logger.error(`syncAllCampaignXp failed: ${(err as any)?.message ?? err}`);
  }
}

/** Added to a join record's paid stages when the campaign is claimed as completed under stage payouts,
 * so it's never mistaken for a one-lump claim from before stage payouts existed. */
export const COMPLETED_MARK = "__completed";

/**
 * Pays a person the XP for every stage they've completed (and that has unlocked for them) and
 * haven't been paid for yet, on one campaign or on all the campaigns they joined.
 * - Each stage is recorded on the join record before XP is added, so a stage can only ever pay once.
 * - A join record is never paid more than the campaign's total (1,000 or 2,500), even if the
 *   campaign's stages are edited later.
 * Never throws. `ok` is false if something failed part-way (the next call picks up what's left).
 */
export async function settleStageXp(userId: unknown, campaignId?: unknown): Promise<{ paid: number; ok: boolean }> {
  let paid = 0;
  // Without a real person this would match every participant's records
  if (typeof userId !== "string" && !(userId instanceof mongoose.Types.ObjectId)) return { paid, ok: false };
  if (!mongoose.Types.ObjectId.isValid(String(userId))) return { paid, ok: false };
  try {
    const joins = await campaignCompleted.find({ user: userId, ...(campaignId ? { campaign: campaignId } : {}) })
      .select("_id campaign createdAt campaignCompleted xpStagesPaid xpEarned").lean() as any[];
    for (const j of joins) {
      // Claimed in one lump before stage payouts existed: they already have this campaign's XP
      if (j.campaignCompleted && !(j.xpStagesPaid?.length)) continue;

      const c = await campaign.findById(j.campaign).select("hub stages").lean() as any;
      if (!c || !(await usesFixedXp(c))) continue;
      const stages = await stagesOf(j.campaign, c);
      if (!stages.length) continue;
      const shares = stageXpShares(stages.length);
      const total = campaignXpTotal(stages.length);
      let earned = Number(j.xpEarned ?? 0);

      const done = await campaignQuestCompleted.find({ user: userId, campaignQuest: { $in: stages.flatMap(s => s.taskIds) }, done: true })
        .select("campaignQuest").lean() as any[];
      const doneIds = new Set(done.map(d => String(d.campaignQuest)));
      const joinedAt = new Date(j.createdAt).getTime();

      for (let i = 0; i < stages.length; i++) {
        const st = stages[i]!;
        const unlocked = joinedAt + st.offsetDays * DAY_MS <= Date.now();
        if (!unlocked || !st.taskIds.every(t => doneIds.has(t))) continue;
        if ((j.xpStagesPaid ?? []).includes(st.key)) continue;

        // Never past the campaign's total for this person
        const xp = Math.min(shares[i]!, total - earned);
        if (xp <= 0) continue;
        // Record the stage first: only one request can win it, and only while it stays within the total
        const won = await campaignCompleted.findOneAndUpdate(
          { _id: j._id, xpStagesPaid: { $ne: st.key }, $expr: { $lte: [{ $add: [{ $ifNull: ["$xpEarned", 0] }, xp] }, total] } },
          { $addToSet: { xpStagesPaid: st.key }, $inc: { xpEarned: xp } },
          { new: true },
        ) as any;
        if (!won) continue;
        earned = Number(won.xpEarned ?? earned + xp);

        const updated = await user.findByIdAndUpdate(userId, { $inc: { xp } }, { new: true });
        if (!updated) continue;
        const level = await updateLevel(updated);
        if (level !== updated.level) await user.updateOne({ _id: userId }, { $set: { level } });
        await campaign.updateOne({ _id: j.campaign }, { $inc: { xpClaimed: xp } });
        await xpLog.create({ address: updated.address, username: updated.username, amount: xp, status: "success", type: "campaign" });
        paid += xp;
      }
    }
    return { paid, ok: true };
  } catch (err) {
    logger.error(`settleStageXp(${String(userId)}) failed: ${(err as any)?.message ?? err}`);
    return { paid, ok: false };
  }
}

/** settleStageXp, returning just the XP paid (for fire-and-forget callers). */
export const payCompletedStageXp = async (userId: unknown, campaignId?: unknown): Promise<number> =>
  (await settleStageXp(userId, campaignId)).paid;
