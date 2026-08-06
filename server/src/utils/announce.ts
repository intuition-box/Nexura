import { alreadyAnnounced } from "@/models/alreadyAnnounced.model";
import { EmbedBuilder } from "discord.js";
import client from "../../client";
import { isMemberOfGuild } from "./utils";
import logger from "@/config/logger";

function getNextMilestone(currentXP: number) {
  const milestones = [
    1000, 3000, 6000, 10000, 15000, 20000, 30000, 40000, 50000, 65000, 75000,
    100000, 150000, 200000, 300000, 350000, 400000, 500000,
  ].sort((a, b) => a - b);
  return milestones.find((m) => m > currentXP) ?? null;
}

export const announceMilestone = async (data: any) => {
  try {
    if (
      !data ||
      !data.id ||
      !data.discordId ||
      data.xp == null ||
      data.milestone == null ||
      data.streak == null ||
      data.questsCompleted == null ||
      data.campaignsCompleted == null ||
      data.lessonsCompleted == null
    ) {
      logger.error("[milestone] Invalid or incomplete data object:", data);
      return false;
    }

    if (!/^\d+$/.test(data.discordId)) {
      logger.error("[milestone] Invalid discordId:", data.discordId);
      return false;
    }

    const member = await isMemberOfGuild("1419336727302111367", data.discordId);
    if (!member) {
      logger.error("[milestone] user not on discord server:", data.discordId);
      return false;
    }

    // Prevent the same milestone from being announced twice
    const announced = await alreadyAnnounced
      .findOne({
        user: data.id,
        milestone: data.milestone,
        discordId: data.discordId,
      })
      .lean();
    if (announced) {
      return false;
    }

    if (!client.isReady()) {
      logger.error("[milestone] Discord client is not ready.");
      return false;
    }

    const channel = await client.channels.fetch(process.env.MILESTONE_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) {
      logger.error("[milestone] Channel not found or is not a text channel.");
      return false;
    }

    const next = getNextMilestone(data.xp);

    const embed = new EmbedBuilder()
      .setColor("#8B5CF6")
      .setTitle("XP Milestone Unlocked! 🎉")
      .setDescription(`Reached **${data.milestone.toLocaleString()} XP!**`)
      .addFields(
        {
          name: "Current XP",
          value: data.xp.toLocaleString(),
          inline: true,
        },
        {
          name: "Next Milestone",
          value: next
            ? `${next.toLocaleString()} XP`
            : "Maximum milestone reached",
          inline: true,
        },
        {
          name: "Check-in Streak",
          value: data.streak != null ? `${data.streak} Days` : "N/A",
          inline: true,
        },
        {
          name: "Quests Completed",
          value:
            data.questsCompleted != null
              ? data.questsCompleted.toLocaleString()
              : "N/A",
          inline: true,
        },
        {
          name: "Campaigns Completed",
          value:
            data.campaignsCompleted != null
              ? data.campaignsCompleted.toLocaleString()
              : "N/A",
          inline: true,
        },
        {
          name: "Lessons Completed",
          value:
            data.lessonsCompleted != null
              ? data.lessonsCompleted.toLocaleString()
              : "N/A",
          inline: true,
        },
      )
      .setFooter({ text: "Powered by Nexura 💜" })
      .setTimestamp();

    await channel.send({
      content: `Congratulations <@${data.discordId}>!`,
      embeds: [embed],
    });

    await alreadyAnnounced.create({
      discordId: data.discordId,
      milestone: data.milestone,
      user: data.id,
    });

    console.log(
      `[milestone] Announcement sent for Discord ID: ${data.discordId} — ${data.milestone} XP`,
    );

    return true;
  } catch (err) {
    logger.error(
      "[milestone] Error:",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
};
