import { allowSharedHubEmails } from "@/utils/hubAccounts";
import express from "express";
import cors from "cors";
import { Events } from "discord.js";
import helmet from "helmet";
import { port, BOT_TOKEN, SERVER_ENV } from "@/utils/env.utils";
import DB from "@/config/db";
import logger from "@/config/logger";
import appRoutes from "@/routes";
import client from "./client";
import { firstMessage } from "@/models/msg.model";
import { startAdminActivityCron } from "@/utils/adminActivityCron";
import { startRelicHodlCron } from "@/utils/relicHodlCron";
import { initRedis } from "@/config/redis";
import { configureAxiosResilience } from "@/utils/resilience";
import { syncAllCampaignXp } from "@/utils/campaignXp";
import { runExclusively } from "@/utils/jobLock";
import { startTrustEligibilityCron } from "@/utils/campaignRewards";
import { stripOperators } from "@/middlewares/stripOperators";

// Every outside call (Discord, X, Intuition…) gets a time limit and retries on brief failures
configureAxiosResilience();

const server = express();

server.use(cors({ origin: SERVER_ENV.ALLOWED_ORIGINS, exposedHeaders: ["x-dev-access"] }));
server.use(helmet());
server.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(stripOperators);

// Never write passwords, codes or tokens to the logs
const SECRET_KEYS = /pass(word)?|code|otp|token|secret|signature|authorization|private/i;
const redact = (value: unknown, depth = 0): unknown => {
	if (depth > 6 || value === null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
	return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) =>
		[k, SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1)]));
};

server.use((req, res, next) => {
	const start = Date.now();
	const originalUrl = req.url;
	res.on("finish", () => {
		const duration = Date.now() - start;
		const logMsg = `${req.method} ${originalUrl} ${res.statusCode} ${duration}ms`;
		console.log(`[REQUEST] ${logMsg}`);
		if (req.body && Object.keys(req.body).length > 0) {
			console.log(`[BODY]`, JSON.stringify(redact(req.body), null, 2));
		}
	});
	next();
});

server.use("/api", appRoutes);

client.once(Events.ClientReady, (readyClient: any) => {
	logger.info(`Logged in as ${readyClient.user?.tag}`);
});

server.listen(port, async () => {
	await DB();
	
	// Start admin activity cron job
	startAdminActivityCron();

	// Studio emails can join several hubs: remove the old unique email index once
	void allowSharedHubEmails();

	// Start relic hodl cron job
	startRelicHodlCron();

	// Existing Studio campaigns switch to the fixed XP (1,000 one-time / 2,500 with stages); safe to repeat
	void runExclusively("campaign-xp-sync", 10 * 60 * 1000, syncAllCampaignXp);

	// Marks participants eligible for TRUST rewards as they qualify, so the app can tell them
	startTrustEligibilityCron();

	if (BOT_TOKEN) {
		await client.login(BOT_TOKEN);
	} else {
		logger.warn("BOT_TOKEN not set – Discord bot disabled");
	}  logger.info(`Server is running on port ${port}`);

  // Fire-and-forget Redis init; initRedis() resolves once the connect either
  // succeeds or hits REDIS_CONNECT_TIMEOUT_MS (default 5s). Never blocks the
  // HTTP server so cache outages can never blackhole startup again.
  initRedis().catch((error: any) =>
    logger.error(`❌ initRedis crashed unexpectedly: ${error?.message}`),
  );
});
