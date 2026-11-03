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

const router = Router();

router
	.patch("/add-campaign-address", authenticateHubAdmin, addCampaignAddress)
	.post("/complete-campaign", authenticateUser, claimCampaignRewards)
	.patch("/close-campaign", authenticateHubAdmin, closeCampaign)
	.patch("/reopen-campaign", authenticateHubAdmin, reopenCampaign)
	.post("/create-campaign", authenticateHubAdmin, upload.single("coverImage"), createCampaign)
	.post("/join-campaign", authenticateUser, joinCampaign)
	.get("/quests", authenticateUser2, fetchCampaignQuests)
	.patch("/update-campaign", authenticateHubAdmin, updateCampaign);

export default router;
