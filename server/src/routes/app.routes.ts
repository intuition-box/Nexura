import { blockLockedCampaignStage } from "@/middlewares/campaignStageLock";
import { authenticateUser, authenticateUser2 } from "@/middlewares/auth.middleware";
// import { rateLimiter } from "@/middlewares/ratelimiter";
import { Router } from "express";
import {
	checkXTask,
	checkDiscordTask,
	home,
  getStudioPaymentConfig,
  getAnalytics,
	saveCv,
	updateX,
  updateDiscord,
	getClaims,
  getTriple,
  allowNexonsMint,
  referralLeaderboard,
  searchTriple,
} from "@/controllers/app.controller";
import {
  discordCallback,
  xCallback,
  disconnectX,
  disconnectDiscord,
} from "@/controllers/auth.controller";

const router = Router();

router
  .get("/", home)
  .get("/studio-payment-config", getStudioPaymentConfig)
  .post("/allow-mint", authenticateUser, allowNexonsMint)
  .get("/get-claims", authenticateUser2, getClaims)
  .post("/search-for-claim", authenticateUser2, searchTriple)
  .get("/get-triple", authenticateUser2, getTriple)
  .get("/get-analytics", getAnalytics)
  // Campaign tasks in a stage that hasn't opened yet for this person are refused (see campaignStageLock)
  .post("/check-x", authenticateUser, blockLockedCampaignStage(), checkXTask)
  .post("/check-discord", authenticateUser, blockLockedCampaignStage(), checkDiscordTask)
  .get("/save-cv", authenticateUser, saveCv)
  .get("/referral-leaderboard", referralLeaderboard)
  .get("/auth/discord/callback", discordCallback)
  .get("/auth/x/callback", xCallback)
  .get("/auth/x/logout", authenticateUser, disconnectX)
  .get("/auth/discord/logout", authenticateUser, disconnectDiscord)
  .get("/discord/update", authenticateUser, updateDiscord)
  .get("/x/update", authenticateUser, updateX);

export default router;
