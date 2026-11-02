import { Router } from "express";
import { getLeaderboard } from "@/controllers/app.controller";
import { fetchCampaigns } from "@/controllers/campaign.controller";
import adminRoutes from "./admin.routes.ts";
import campaignRoutes from "./campaign.routes.ts";
import hubRoutes from "./hub.routes.ts";
import questRoutes from "./quest.routes.ts";
import userRoutes from "./user.routes.ts";
import appRoutes from "./app.routes.ts";
import lessonRoutes from "./lesson.routes.ts";
import devAccessRoutes from "./devAccess.routes.ts";
import { devAccessGate } from "@/middlewares/devAccess.middleware";
import {
	fetchEcosystemDapps,
	fetchMiniQuests,
	fetchQuests,
} from "@/controllers/quest.controller.ts";
import { signIn } from "@/controllers/auth.controller";
import { createAdmin, adminLogin, forgotAdminPassword, resetAdminPassword } from "@/controllers/admin.controller";
import { authenticateUser2, authenticateAdmin, authenticateUser } from "@/middlewares/auth.middleware";
import userHubRoutes from "./userHub.routes.ts";
import { attemptGuard, authIpLimiter, codeSendLimiter } from "@/middlewares/authGuard";
// import testSeedRoutes from "./test-seed.routes.ts";
import { confirmHubEmailValidation, validateHubEmail, adminConnectDiscord, discordAdminCallback } from "@/controllers/hub.auth.controller.ts";

const router = Router();

router
	.use(devAccessGate)
	.use("/dev-access", devAccessRoutes)
	.get("/server-time", (_req, res) => {
		res.json({ serverTime: Date.now() });
	})
  // Sign-in and code checks are rate limited and lock out after repeated wrong attempts (see authGuard)
  .post("/admin/register", authIpLimiter, attemptGuard("platform-register"), createAdmin)
  .post("/admin/login", authIpLimiter, attemptGuard("platform-login"), adminLogin)
  .post("/admin/forgot-password", codeSendLimiter, forgotAdminPassword)
  .post("/admin/reset-password", authIpLimiter, resetAdminPassword)
  .get("/admin/connect-discord", adminConnectDiscord)
  .get("/admin/discord/callback", discordAdminCallback)
  .post("/user/sign-in", authIpLimiter, signIn)
	.use("/", appRoutes)
	.use("/admin", authenticateAdmin, adminRoutes)
	.get("/ecosystem-quests", authenticateUser2, fetchEcosystemDapps)
	.get("/quests", authenticateUser2, fetchQuests)
	.get("/campaigns", authenticateUser2, fetchCampaigns)
	.use("/campaign", campaignRoutes)
  .get("/leaderboard", authenticateUser2, getLeaderboard)
	.get("/quest/fetch-mini-quests", authenticateUser2, fetchMiniQuests)
  .use("/hub", hubRoutes)
	.use("/user-hub", userHubRoutes)
	.use("/quest", authenticateUser, questRoutes)
  .use("/lesson", lessonRoutes)
  .post("/hub-auth/validate-email", codeSendLimiter, validateHubEmail)
	.post("/auth/confirm-hub-email-validation", authIpLimiter, attemptGuard("hub-email-code"), confirmHubEmailValidation)
	.use("/user", authenticateUser, userRoutes);

export default router;
