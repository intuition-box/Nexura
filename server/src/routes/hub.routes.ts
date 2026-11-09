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
import { authenticateHubAdmin, authenticateHubAdmin2, upload } from "@/middlewares/auth.middleware";
import { markMyFeedbackSeen, myFeedback, replyToMyFeedback, submitFeedback } from "@/controllers/feedback.controller";
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
import { declineCoHostInvite, getCampaignCoHosts, getCoHostInvites, getCoHostedCampaign, inviteCoHost, markCoHostReady, removeCoHost, saveCoHostStages, searchCoHostStudios } from "@/controllers/coHost.controller";

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
  .post("/feedback", authenticateHubAdmin2, ...upload.array("attachments", 3), submitFeedback("studio"))
  .get("/feedback", authenticateHubAdmin2, myFeedback("studio"))
  .post("/feedback/reply", authenticateHubAdmin2, replyToMyFeedback("studio"))
  .post("/feedback/seen", authenticateHubAdmin2, markMyFeedbackSeen("studio"))
  .patch("/publish-campaign", authenticateHubAdmin, requireInHub(campaignInHub, fromQuery("id"), "campaign"), requireStudioPayment, publishCampaign)
  .get("/co-hosts/search", authenticateHubAdmin, searchCoHostStudios)
  .get("/campaign-co-hosts", authenticateHubAdmin2, requireInHub(campaignInHub, fromQuery("id"), "campaign"), getCampaignCoHosts)
  .post("/campaign-co-hosts/invite", authenticateHubAdmin, requireInHub(campaignInHub, fromQuery("id"), "campaign"), inviteCoHost)
  .post("/campaign-co-hosts/remove", authenticateHubAdmin, requireInHub(campaignInHub, fromQuery("id"), "campaign"), removeCoHost)
  .get("/co-host-invites", authenticateHubAdmin2, getCoHostInvites)
  .post("/co-host-invites/decline", authenticateHubAdmin, declineCoHostInvite)
  .get("/co-hosted-campaign", authenticateHubAdmin, getCoHostedCampaign)
  .patch("/co-hosted-campaign/stages", authenticateHubAdmin, saveCoHostStages)
  .post("/co-hosted-campaign/ready", authenticateHubAdmin, markCoHostReady)
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
