import { Router } from "express";
import {
  signIn, checkSignInWallet, proveWallet,
  hubAdminSignUp,
  forgotPassword,
  resetPassword,
  logout,
  superAdminSignUp,
  hubDiscordCallback,
  fetchRoles,
  fetchChannels,
  fetchServers
} from "@/controllers/hub.auth.controller";
import { authenticateHubAdmin, authenticateHubAdmin2 } from "@/middlewares/auth.middleware";
import { fetchHubCampaigns, publishCampaign } from "@/controllers/campaign.controller";
import { requireStudioPayment } from "@/controllers/studioPayment.controller";
import { validateCampaignSubmissions, validateCampaignSubmissionsBulk, getCampaignSubmissions, getHub, getHubAdmins, updateIds, checkUsernameAvailable, changeUsername, getHubNotifications, getHubActivity, markHubNotificationsRead } from "@/controllers/hub.controller";
import { getSubmissionCampaigns, getCampaignSubmissionDetails } from "@/controllers/submissions.controller";
import { disableTwoFactor, enableTwoFactor, setupTwoFactor, verifyTwoFactorLogin } from "@/controllers/twoFactor.controller";
import { getRetentionDraft, saveRetentionDraft } from "@/controllers/retentionDraft.controller";
import hubAppRoutes from "./hub.app.routes";
import { attemptGuard, authIpLimiter, codeSendLimiter } from "@/middlewares/authGuard";
import { requireInHub, fromQuery, campaignInHub } from "@/utils/hubOwnership";
import governanceRoutes from "./governance.routes";

const router = Router();

router
  // --- Any-admin routes (authenticateHubAdmin2) ---
  .get("/get-campaigns", authenticateHubAdmin2, fetchHubCampaigns)
  .get("/campaign-submissions", authenticateHubAdmin2, getCampaignSubmissions)
  .get("/submission-campaigns", authenticateHubAdmin2, getSubmissionCampaigns)
  .get("/campaign-submission-details", authenticateHubAdmin2, getCampaignSubmissionDetails)
  .post("/validate-campaign-submissions", authenticateHubAdmin2, validateCampaignSubmissions)
  .post("/validate-campaign-submissions-bulk", authenticateHubAdmin2, validateCampaignSubmissionsBulk)
  .get("/me", authenticateHubAdmin2, getHub)
  .get("/username-available", authenticateHubAdmin2, checkUsernameAvailable)
  .post("/2fa/setup", authenticateHubAdmin2, setupTwoFactor)
  .post("/2fa/enable", authenticateHubAdmin2, enableTwoFactor)
  .post("/2fa/disable", authenticateHubAdmin2, disableTwoFactor)
  .post("/2fa/verify-login", authIpLimiter, verifyTwoFactorLogin)
  .patch("/username", authenticateHubAdmin2, changeUsername)
  .get("/retention-draft", authenticateHubAdmin2, getRetentionDraft)
  .put("/retention-draft", authenticateHubAdmin2, saveRetentionDraft)
  .get("/hub-admins", authenticateHubAdmin2, getHubAdmins)
  .patch("/publish-campaign", authenticateHubAdmin, requireInHub(campaignInHub, fromQuery("id"), "campaign"), requireStudioPayment, publishCampaign)
  // --- Public routes ---
  // Sign-in and code checks are rate limited and lock out after repeated wrong attempts (see authGuard)
  .post("/sign-in", authIpLimiter, attemptGuard("hub-login"), signIn)
  .post("/wallet-proof", authIpLimiter, proveWallet)
  .post("/sign-in/check", authIpLimiter, attemptGuard("hub-login-check"), checkSignInWallet)
  .post("/logout", authenticateHubAdmin2, logout)
  .post("/reset-password", authIpLimiter, attemptGuard("hub-reset"), resetPassword)
  .post("/forgot-password", codeSendLimiter, forgotPassword)
  .post("/sign-up", authIpLimiter, superAdminSignUp)
  .get("/discord/callback", hubDiscordCallback)
  .get("/get-roles", fetchRoles)
  .get("/get-channels", fetchChannels)
  .get("/get-servers", fetchServers)
  .post("/admin/sign-up", authIpLimiter, attemptGuard("hub-invite"), hubAdminSignUp)
  .patch("/update-ids", authenticateHubAdmin2, updateIds)
  .get("/notifications", authenticateHubAdmin2, getHubNotifications)
  .get("/activity", authenticateHubAdmin2, getHubActivity)
  .post("/notifications/read", authenticateHubAdmin2, markHubNotificationsRead)
  // --- Admin Management governance (any admin; roles checked in the controller) ---
  .use("/governance", authenticateHubAdmin2, governanceRoutes)
  // --- Superadmin-only routes ---
  .use("/", authenticateHubAdmin, hubAppRoutes)

export default router;
