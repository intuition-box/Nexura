import {
  addCampaignAddress,
  closeCampaign,
  createCampaign,
  deleteCampaign,
  recordCampaignRewardsWithdrawal,
  reopenCampaign,
  updateCampaign
} from "@/controllers/campaign.controller";
import { createQuest, saveQuest, saveQuestWithMiniQuests, deleteMiniQuest, deleteQuest, getHubQuests, publishQuest } from "@/controllers/quest.controller";
import {
  deleteCampaignQuest,
  disconnectHubDiscord,
  getCampaign,
  saveCampaign,
  saveCampaignWithQuests,
  uploadCampaignCover,
  updateCamapaignQuest,
  updateHub,
  updateIds,
  createHub,
  savePaymentHash,
  resendInvite
} from "@/controllers/hub.controller";
import {
  createLesson,
  deleteLesson,
  updateLesson,
  createMiniLesson,
  updateMiniLesson,
  deleteMiniLesson,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  createVideoLesson,
  updateVideoLesson,
  deleteVideoLesson,
  reorderLessonContent,
  publishLesson,
  unpublishLesson,
  updateQuestionIntro,
  getLessonDetailsForAdmin,
  getHubLessons
} from "@/controllers/lesson.controller";
import { Router } from "express";
import { upload } from "@/config/multer";
import { requireStudioPayment } from "@/controllers/studioPayment.controller";
import {
  requireInHub, fromQuery, fromBody, fromAny,
  campaignInHub, campaignQuestInHub, questInHub, miniQuestInHub,
  lessonInHub, miniLessonInHub, questionInHub, videoLessonInHub,
} from "@/utils/hubOwnership";

// Every id below must belong to the signed-in admin's hub (see hubOwnership)
const ownCampaign = (opts?: { optional?: boolean }) => requireInHub(campaignInHub, fromQuery("id"), "campaign", opts);
const ownCampaignQuest = requireInHub(campaignQuestInHub, fromQuery("id"), "campaign task");
const ownQuest = (opts?: { optional?: boolean }) => requireInHub(questInHub, fromAny("id", "questId"), "quest", opts);
const ownMiniQuest = requireInHub(miniQuestInHub, fromAny("id", "questId"), "quest task");
const ownLessonBy = (pick: ReturnType<typeof fromBody>) => requireInHub(lessonInHub, pick, "lesson");
const ownMiniLessonBy = (pick: ReturnType<typeof fromBody>) => requireInHub(miniLessonInHub, pick, "lesson section");
const ownQuestionBy = (pick: ReturnType<typeof fromBody>) => requireInHub(questionInHub, pick, "lesson question");
const ownVideoBy = (pick: ReturnType<typeof fromBody>) => requireInHub(videoLessonInHub, pick, "lesson video");

const router = Router();

router
  .patch("/save-campaign-quests", ownCampaign({ optional: true }), upload.single("coverImage"), saveCampaignWithQuests)
  .patch("/save-campaign", ownCampaign({ optional: true }), upload.single("coverImage"), saveCampaign)
  .post("/upload-campaign-cover", upload.single("coverImage"), uploadCampaignCover)
  .get("/get-campaign", ownCampaign(), getCampaign)
  .get("/get-quests", getHubQuests)
  // Deleting the hub, and adding, removing or re-roling admins, only happen through approved
  // proposals in Admin Management (/hub/governance), never by one admin directly
  .delete("/delete-mini-quest", ownMiniQuest, deleteMiniQuest)
  .post("/create-quest", upload.single("coverImage"), createQuest)
  .post("/save-quest", ownQuest({ optional: true }), upload.single("coverImage"), saveQuest)
  .post("/save-mini-quest", ownQuest({ optional: true }), upload.single("coverImage"), saveQuestWithMiniQuests)
  .patch("/publish-quest", ownQuest(), requireStudioPayment, publishQuest)
  .delete("/delete-quest", ownQuest(), deleteQuest)
  .patch("/update-ids", updateIds)
  .post("/create-hub", upload.single("logo"), createHub)
  .patch("/update-hub", upload.fields([{ name: "logo", maxCount: 1 }, { name: "document", maxCount: 1 }]), updateHub)
  .patch("/disconnect-discord", disconnectHubDiscord)
  .patch("/save-payment-hash", savePaymentHash)
  .post("/resend-invite", resendInvite)
  // Revoking an invitation is a governance proposal (/hub/governance, kind "revokeInvite")
  .post("/create-campaign", upload.single("coverImage"), createCampaign)
  .delete("/delete-campaign-quest", ownCampaignQuest, deleteCampaignQuest)
  .delete("/delete-campaign", deleteCampaign)
  .patch("/update-campaign", upload.single("coverImage"), updateCampaign)
  .patch("/update-campaign-quest", ownCampaignQuest, updateCamapaignQuest)
  .patch("/close-campaign", closeCampaign)
  .patch("/reopen-campaign", reopenCampaign)
  .patch("/add-campaign-address", addCampaignAddress)
  .patch("/record-campaign-rewards-withdrawal", recordCampaignRewardsWithdrawal)
  .post("/create-lesson", upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "profileImage", maxCount: 1 }]), createLesson)
  .delete("/delete-lesson", ownLessonBy(fromQuery("id")), deleteLesson)
  .patch("/update-lesson", upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "profileImage", maxCount: 1 }]), ownLessonBy(fromBody("lessonId")), updateLesson)
  .post("/create-mini-lesson", ownLessonBy(fromBody("lesson")), createMiniLesson)
  .patch("/update-mini-lesson", ownMiniLessonBy(fromBody("miniLessonId")), updateMiniLesson)
  .delete("/delete-mini-lesson", ownMiniLessonBy(fromQuery("id")), deleteMiniLesson)
  .post("/create-question", ownLessonBy(fromBody("lesson")), createQuestion)
  .patch("/update-question", ownQuestionBy(fromBody("questionId")), updateQuestion)
  .delete("/delete-question", ownQuestionBy(fromQuery("id")), deleteQuestion)
  .post("/create-video-lesson", ownLessonBy(fromBody("lesson")), createVideoLesson)
  .patch("/update-video-lesson", ownVideoBy(fromBody("videoLessonId")), updateVideoLesson)
  .delete("/delete-video-lesson", ownVideoBy(fromQuery("id")), deleteVideoLesson)
  .patch("/reorder-lesson-content", ownLessonBy(fromBody("lessonId")), reorderLessonContent)
  .patch("/publish-lesson", ownLessonBy(fromBody("lessonId")), requireStudioPayment, publishLesson)
  .patch("/unpublish-lesson", ownLessonBy(fromBody("lessonId")), unpublishLesson)
  .patch("/update-question-intro", ownQuestionBy(fromBody("questionId")), updateQuestionIntro)
  .get("/get-lesson-details", ownLessonBy(fromQuery("id")), getLessonDetailsForAdmin)
  .get("/get-lessons", getHubLessons);

export default router;
