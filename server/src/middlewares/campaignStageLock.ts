import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";
import logger from "@/config/logger";
import { campaign, campaignCompleted } from "@/models/campaign.model";
import { campaignQuest } from "@/models/quests.model";
import { buildCampaignStages } from "@/utils/retention";
import { FORBIDDEN } from "@/utils/status.utils";

const DAY_MS = 86_400_000;

/**
 * When a campaign task's stage opens for this person, or null if it's open now (or isn't a
 * campaign task). Stages open a set number of days after the person joined the campaign.
 */
export async function campaignTaskUnlockAt(userId: unknown, questId: string): Promise<Date | null> {
  // Signed out: treat like someone who hasn't joined (only stages that open on joining are open)
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) userId = null;
  const task = await campaignQuest.findById(questId).select("campaign").lean() as any;
  if (!task?.campaign) return null;
  const [c, quests, join] = await Promise.all([
    campaign.findById(task.campaign).select("stages").lean(),
    campaignQuest.find({ campaign: task.campaign }).select("_id stage").lean() as Promise<any[]>,
    userId ? campaignCompleted.findOne({ user: userId, campaign: task.campaign }).select("createdAt").lean() as Promise<any> : Promise.resolve(null),
  ]);
  const stage = buildCampaignStages(c as any, quests).find(st => st.taskIds.includes(String(questId)));
  if (!stage || stage.offsetDays <= 0) return null;
  // Not joined yet: the countdown would only start on joining, so later stages are still locked
  const start = join?.createdAt ? new Date(join.createdAt).getTime() : Date.now();
  const unlockAt = start + stage.offsetDays * DAY_MS;
  return unlockAt > Date.now() ? new Date(unlockAt) : null;
}

const waitText = (until: Date) => {
  // Whole hours, rounded up, then split into days and hours (never "6 days and 24 hours")
  const totalHours = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 3_600_000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const d = `${days} day${days === 1 ? "" : "s"}`, h = `${hours} hour${hours === 1 ? "" : "s"}`;
  return days && hours ? `${d} and ${h}` : days ? d : h;
};

/**
 * Route guard for user task actions: refuses any campaign task whose stage hasn't opened yet for
 * the signed-in person, whatever the app shows. The task id can arrive under any of these keys;
 * ids that aren't campaign tasks are ignored.
 */
export const blockLockedCampaignStage = (keys: string[] = ["id", "questId", "campaignQuestId", "miniQuestId"]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).id;
      const ids = new Set<string>();
      for (const k of keys) {
        for (const src of [(req.body as any)?.[k], (req.query as any)?.[k]]) {
          if (typeof src === "string" && mongoose.Types.ObjectId.isValid(src)) ids.add(src);
        }
      }
      for (const id of ids) {
        const unlockAt = await campaignTaskUnlockAt(userId, id);
        if (unlockAt) {
          res.status(FORBIDDEN).json({
            error: `This stage isn't open yet. It opens in ${waitText(unlockAt)}.`,
            unlocksAt: unlockAt.toISOString(),
          });
          return;
        }
      }
      next();
    } catch (err) {
      logger.error(`blockLockedCampaignStage failed: ${(err as any)?.message ?? err}`);
      next(err);
    }
  };
