import { Router } from "express";
import {
	addCampaignAddress,
	claimCampaignRewards,
	closeCampaign,
	createCampaign,
	joinCampaign,
	reopenCampaign,
	updateCampaign,
} from "@/controllers/campaign.controller";
import { fetchCampaignQuests } from "@/controllers/quest.controller";
import {
	authenticateHubAdmin,
	authenticateUser,
	authenticateUser2,
	upload,
} from "@/middlewares/auth.middleware";

import { studioGate } from "@/middlewares/studioGate";

const router = Router();

router
	.patch("/add-campaign-address", studioGate, authenticateHubAdmin, addCampaignAddress)
	.post("/complete-campaign", authenticateUser, claimCampaignRewards)
	.patch("/close-campaign", studioGate, authenticateHubAdmin, closeCampaign)
	.patch("/reopen-campaign", studioGate, authenticateHubAdmin, reopenCampaign)
	.post("/create-campaign", studioGate, authenticateHubAdmin, upload.single("coverImage"), createCampaign)
	.post("/join-campaign", authenticateUser, joinCampaign)
	.get("/quests", authenticateUser2, fetchCampaignQuests)
	.patch("/update-campaign", studioGate, authenticateHubAdmin, updateCampaign);

export default router;
