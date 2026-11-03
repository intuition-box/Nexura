import logger from "@/config/logger";
import { campaign } from "@/models/campaign.model";
import { hub } from "@/models/hub.model";
import { campaignQuest } from "@/models/quests.model";
import { parseDate } from "@/utils/dates";
import { BAD_REQUEST, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } from "@/utils/status.utils";

const DISCORD_CAMPAIGN_TAGS = new Set([
  "discord",
  "join",
  "join-discord",
  "message",
  "message-discord",
  "acquire-role-discord",
  "send-message-discord",
]);

const isDiscordCampaignTask = (task: Record<string, any>) =>
  DISCORD_CAMPAIGN_TAGS.has(String(task?.tag ?? "").trim()) ||
  String(task?.category ?? "").trim() === "discord";

const getCampaignDiscordGuildIds = async (campaignId: string) => {
  const quests = await campaignQuest.find({ campaign: campaignId }).select("guildId tag category").lean();

  return Array.from(
    new Set(
      quests
        .filter((quest: any) => isDiscordCampaignTask(quest))
        .map((quest: any) => String(quest.guildId ?? "").trim())
        .filter(Boolean)
    )
  );
};

const resolveCampaignDiscordLaunchGuildId = async (campaignDoc: any) => {
  const storedGuildId = String(campaignDoc?.discordLaunchGuildId ?? "").trim();
  if (storedGuildId) return storedGuildId;

  const guildIds = await getCampaignDiscordGuildIds(String(campaignDoc?._id ?? "").trim());
  return guildIds[0] ?? "";
};

const hasDiscordTasksInCampaign = async (campaignId: string) => {
  const quests = await campaignQuest.find({ campaign: campaignId }).select("tag category").lean();
  return quests.some((quest: any) => isDiscordCampaignTask(quest));
};

export const publishAdminCampaign = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { id } = req.query as { id: string };
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "campaign id is required" });
      return;
    }

    const nexuraHub = await hub.findById(req.admin?.hub);
    if (!nexuraHub) {
      res.status(NOT_FOUND).json({ error: "nexura campaigns hub is invalid" });
      return;
    }

    const campaignExists = await campaign.findById(id);
    if (!campaignExists) {
      res.status(NOT_FOUND).json({ error: "campaign not found" });
      return;
    }
    if (String(campaignExists.hub) !== String(nexuraHub._id)) {
      res.status(FORBIDDEN).json({ error: "you are not allowed to publish this campaign" });
      return;
    }
    if (campaignExists.status !== "Save") {
      res.status(BAD_REQUEST).json({ error: "campaign is not in save status" });
      return;
    }

    const rewardPool = Number(campaignExists.reward?.pool ?? 0);
    const maxParticipants = Number((campaignExists as any).maxParticipants ?? 0);
    if (rewardPool > 0 && maxParticipants <= 0) {
      res.status(BAD_REQUEST).json({
        error: "set a participant limit before publishing a reward campaign",
      });
      return;
    }
    if (rewardPool > 0 && !campaignExists.contractAddress) {
      res.status(FORBIDDEN).json({
        error: "deploy and attach a rewards contract before publishing this campaign",
      });
      return;
    }

    const hasDiscordTasks = await hasDiscordTasksInCampaign(id);
    const currentHubGuildId = String((nexuraHub as any).guildId ?? "").trim();
    const lockedDiscordGuildId = await resolveCampaignDiscordLaunchGuildId(campaignExists);
    const requiredDiscordGuildId = lockedDiscordGuildId || currentHubGuildId;

    if (hasDiscordTasks || lockedDiscordGuildId) {
      if (!(nexuraHub as any).discordConnected || !currentHubGuildId) {
        res.status(FORBIDDEN).json({
          error: "Connect Discord in Studio before publishing a campaign with Discord tasks.",
        });
        return;
      }

      if (currentHubGuildId !== requiredDiscordGuildId) {
        res.status(FORBIDDEN).json({
          error: "This campaign is locked to a different Discord server. Reconnect the original Discord server that was used to launch it before publishing.",
        });
        return;
      }

      (campaignExists as any).discordLaunchGuildId = requiredDiscordGuildId;
      await campaignQuest.updateMany(
        { campaign: id },
        [
          {
            $set: {
              guildId: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$category", "discord"] },
                      { $in: ["$tag", Array.from(DISCORD_CAMPAIGN_TAGS)] },
                    ],
                  },
                  requiredDiscordGuildId,
                  "$guildId",
                ],
              },
            },
          },
        ]
      );
    }

    const startsAt = parseDate(campaignExists.starts_at);
    campaignExists.status = startsAt && startsAt > new Date() ? "Scheduled" : "Active";
    nexuraHub.campaignsCreated += 1;

    await campaignExists.save();
    await nexuraHub.save();

    res.status(OK).json({ message: "campaign published" });
  } catch (error: any) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error publishing campaign" });
  }
};
