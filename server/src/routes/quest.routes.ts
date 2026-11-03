import { blockLockedCampaignStage } from "@/middlewares/campaignStageLock";
import { Router } from "express";
import {
	claimEcosystemQuest,
	submitEcosystemQuest,
	performCampaignQuest,
	setTimer,
	submitQuest,
	claimQuest,
	claimMiniQuest,
	createMiniQuest,
	startQuest
} from "@/controllers/quest.controller";
import { checkRelics, claimRelicReward, updateSubmission, validateAtlasTask, validatePortalTask, validateTrustNameTask } from "@/controllers/app.controller";

// Campaign tasks in a stage that hasn't opened yet for this person are refused here, not just hidden in the app
const stageOpen = blockLockedCampaignStage();

const router = Router();

router
	.post("/claim-ecosystem-quest", claimEcosystemQuest)
	.post("/submit-ecosystem-quest", submitEcosystemQuest)
  .post("/set-timer", setTimer)
	.post("/create-mini-quest", createMiniQuest)
	.post("/start-quest", startQuest)
	.post("/check-portal-task", stageOpen, validatePortalTask)
	.post("/validate-atlas-task", stageOpen, validateAtlasTask)
	.post("/check-atlas-task", stageOpen, validateAtlasTask)
	.post("/verify-relic", checkRelics)
	.post("/claim-relic-reward", claimRelicReward)
	.post("/check-trust-name", stageOpen, validateTrustNameTask)
	.post("/claim-mini-quest", claimMiniQuest)
	.post("/update-submission", stageOpen, updateSubmission)
	.post("/claim-quest", claimQuest)
	.post("/perform-campaign-quest", stageOpen, performCampaignQuest)
	.post("/submit-quest", stageOpen, submitQuest);

export default router;
