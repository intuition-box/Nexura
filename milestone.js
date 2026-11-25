const { EmbedBuilder } = require("discord.js");

const milestones = require("./milestones");
const client = require("./client");

const recentlyAnnounced = new Set();

function getCurrentMilestone(xp) {
    if (xp == null || typeof xp !== "number") return null;

    const sorted = [...milestones].sort((a, b) => a.xp - b.xp);
    let current = null;

    for (const milestone of sorted) {
        if (xp >= milestone.xp) {
            current = milestone;
        } else {
            break;
        }
    }

    return current;
}

function getNextMilestone(xp) {
    if (xp == null || typeof xp !== "number") return null;

    const sorted = [...milestones].sort((a, b) => a.xp - b.xp);
    return sorted.find(m => xp < m.xp) ?? null;
}

async function announceMilestone(data) {
    try {

        if (
            !data ||
            !data.discordId ||
            data.xp == null ||
            data.rank == null ||
            data.checkInStreak == null ||
            data.questsCompleted == null ||
            data.campaignsCompleted == null ||
            data.lessonsCompleted == null ||
            data.eventsParticipated == null
        ) {
            console.error("[milestone] Invalid or incomplete data object:", data);
            return false;
        }

        if (!/^\d+$/.test(data.discordId)) {
            console.error("[milestone] Invalid discordId:", data.discordId);
            return false;
        }

        // Determine the milestone directly from the user's XP
        const currentMilestone = getCurrentMilestone(data.xp);

        if (!currentMilestone) {
            console.error(`[milestone] No milestone found for ${data.discordId} with ${data.xp} XP`);
            return false;
        }

        // Prevent the same milestone from being announced twice
        const dedupKey = `${data.discordId}:${currentMilestone.xp}`;

        if (recentlyAnnounced.has(dedupKey)) {
            console.log(`[milestone] Duplicate blocked for ${data.discordId} at ${currentMilestone.xp} XP`);
            return false;
        }

        recentlyAnnounced.add(dedupKey);
        setTimeout(() => recentlyAnnounced.delete(dedupKey), 60000);

        if (!process.env.MILESTONE_CHANNEL_ID) {
            console.error("[milestone] MILESTONE_CHANNEL_ID is not set.");
            return false;
        }

        if (!client.isReady()) {
            console.error("[milestone] Discord client is not ready.");
            return false;
        }

        const channel = await client.channels.fetch(process.env.MILESTONE_CHANNEL_ID);

        if (!channel || !channel.isTextBased()) {
            console.error("[milestone] Channel not found or is not a text channel.");
            return false;
        }

        const next = getNextMilestone(data.xp);

        const embed = new EmbedBuilder()
            .setColor("#8B5CF6")
            .setTitle("XP Milestone Unlocked! 🎉")
            .setDescription(
                `Congratulations <@${data.discordId}> on reaching **${currentMilestone.xp.toLocaleString()} XP!** ${currentMilestone.emoji}`
            )
            .addFields(
                {
                    name: "Current XP",
                    value: data.xp.toLocaleString(),
                    inline: true
                },
                {
                    name: "Current Rank",
                    value: data.rank != null ? `#${data.rank}` : "N/A",
                    inline: true
                },
                {
                    name: "Next Milestone",
                    value: next ? `${next.xp.toLocaleString()} XP` : "Maximum milestone reached",
                    inline: true
                },
                {
                    name: "Check-in Streak",
                    value: data.checkInStreak != null ? `${data.checkInStreak} Days` : "N/A",
                    inline: true
                },
                {
                    name: "Quests Completed",
                    value: data.questsCompleted != null ? data.questsCompleted.toLocaleString() : "N/A",
                    inline: true
                },
                {
                    name: "Campaigns Completed",
                    value: data.campaignsCompleted != null ? data.campaignsCompleted.toLocaleString() : "N/A",
                    inline: true
                },
                {
                    name: "Lessons Completed",
                    value: data.lessonsCompleted != null ? data.lessonsCompleted.toLocaleString() : "N/A",
                    inline: true
                },
                {
                    name: "Events Participated",
                    value: data.eventsParticipated != null ? data.eventsParticipated.toLocaleString() : "N/A",
                    inline: true
                }
            )
            .setFooter({ text: "Powered by Nexura 💜" })
            .setTimestamp();

        await channel.send({ embeds: [embed] });

        console.log(`[milestone] Announcement sent for Discord ID: ${data.discordId} — ${currentMilestone.xp} XP`);

        return true;

    } catch (err) {
        console.error("[milestone] Error:", err instanceof Error ? err.message : String(err));
        return false;
    }
}

module.exports = announceMilestone;