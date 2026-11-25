require("dotenv").config();

const express = require("express");
const rateLimit = require("express-rate-limit");
const { REST, Routes, SlashCommandBuilder, Events } = require("discord.js");

const client = require("./client");
const handleUserDetails = require("./commands");
const announceMilestone = require("./milestone");

const app = express();
const PORT = process.env.PORT || 3000;

const REQUIRED_ENV = ["DISCORD_TOKEN", "CLIENT_ID", "GUILD_ID", "MILESTONE_CHANNEL_ID", "WEBHOOK_SECRET", "PORT"];

for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`[startup] Missing environment variable: ${key}`);
        process.exit(1);
    }
}

app.use(express.json({ limit: "10kb" }));

const milestoneLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { success: false, message: "Too many requests. Please slow down." }
});

// Second layer of duplicate prevention at the webhook level
const processedMilestones = new Set();

async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName("userdetails")
            .setDescription("View a user's Nexura profile.")
            .addStringOption(option =>
                option
                    .setName("query")
                    .setDescription("Discord username or TNS")
                    .setRequired(true)
            )
    ].map(command => command.toJSON());

    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log("[commands] Registering slash commands...");
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log("[commands] Slash commands registered.");
    } catch (err) {
        console.error("[commands] Failed to register commands:", err instanceof Error ? err.message : String(err));
    }
}

client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} is online.`);
    await registerCommands();

    app.listen(PORT, () => {
        console.log(`API listening on port ${PORT}`);
    });
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    switch (interaction.commandName) {
        case "userdetails":
            await handleUserDetails(interaction);
            break;
    }
});

// Milestone webhook — called by Nexura backend when a user hits a milestone
app.post("/api/v1/milestone", milestoneLimiter, async (req, res) => {
    try {
        const secret = req.headers["x-webhook-secret"];
        if (!secret || secret !== process.env.WEBHOOK_SECRET) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const {
            discordId,
            xp,
            rank,
            checkInStreak,
            questsCompleted,
            campaignsCompleted,
            lessonsCompleted,
            eventsParticipated
        } = req.body;

        if (
            !discordId ||
            xp == null ||
            rank == null ||
            checkInStreak == null ||
            questsCompleted == null ||
            campaignsCompleted == null ||
            lessonsCompleted == null ||
            eventsParticipated == null
        ) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        if (!/^\d+$/.test(discordId)) {
            return res.status(400).json({ success: false, message: "Invalid discordId." });
        }

        if (
            typeof xp !== "number" ||
            typeof rank !== "number" ||
            typeof checkInStreak !== "number" ||
            typeof questsCompleted !== "number" ||
            typeof campaignsCompleted !== "number" ||
            typeof lessonsCompleted !== "number" ||
            typeof eventsParticipated !== "number"
        ) {
            return res.status(400).json({ success: false, message: "All stat fields must be numbers." });
        }

        // Block duplicate milestone announcements at the webhook level
        const dedupKey = `${discordId}:${xp}`;
        if (processedMilestones.has(dedupKey)) {
            console.log(`[webhook] Duplicate milestone request blocked for ${discordId} at ${xp} XP`);
            return res.status(200).json({ success: true, message: "Milestone already announced." });
        }
        processedMilestones.add(dedupKey);
        setTimeout(() => processedMilestones.delete(dedupKey), 60000);

        await announceMilestone({
            discordId,
            xp,
            rank,
            checkInStreak,
            questsCompleted,
            campaignsCompleted,
            lessonsCompleted,
            eventsParticipated
        });

        return res.status(200).json({ success: true, message: "Milestone announced successfully." });

    } catch (err) {
        console.error("[milestone] Error:", err instanceof Error ? err.message : String(err));
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

process.on("SIGTERM", () => {
    console.log("[shutdown] Shutting down...");
    client.destroy();
    process.exit(0);
});

process.on("SIGINT", () => {
    console.log("[shutdown] Shutting down...");
    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);