const { Client, GatewayIntentBits, Events } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers
    ]
});

// Confirms bot is online and connected
client.once(Events.ClientReady, () => {
    console.log(`[client] Logged in as ${client.user.tag}`);
});

// Catches Discord API and WebSocket errors — prevents process crash
client.on("error", (error) => {
    console.error("[client] Discord client error:", error.message);
});

// Logs Discord.js internal warnings
client.on("warn", (message) => {
    console.warn("[client] Warning:", message);
});

// Logs disconnection, reconnection, and resume events
client.on("shardDisconnect", (event) => {
    console.warn("[client] Bot disconnected. Code:", event.code);
});

client.on("shardReconnecting", () => {
    console.log("[client] Reconnecting to Discord...");
});

client.on("shardResume", () => {
    console.log("[client] Connection resumed.");
});

module.exports = client;