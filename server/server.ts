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

const server = express();

server.use(cors({ origin: SERVER_ENV.ALLOWED_ORIGINS }));
server.use(helmet());
server.set("trust proxy", true);
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

server.use((req, res, next) => {
	const start = Date.now();
	const originalUrl = req.url;
	res.on("finish", () => {
		const duration = Date.now() - start;
		const logMsg = `${req.method} ${originalUrl} ${res.statusCode} ${duration}ms`;
		console.log(`[REQUEST] ${logMsg}`);
		if (req.body && Object.keys(req.body).length > 0) {
			console.log(`[BODY]`, JSON.stringify(req.body, null, 2));
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

	// Start relic hodl cron job
	startRelicHodlCron();

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
