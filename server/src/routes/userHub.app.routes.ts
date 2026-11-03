import { userHubLogout } from "@/controllers/hub.auth.controller";
import { createUserHub, updateUserHub, deleteUserHub, getCampaignSubmissions, validateCampaignSubmissions, getUserHub } from "@/controllers/hub.controller";
import { requireStudioPayment, savePaymentHash } from "@/controllers/studioPayment.controller";
import {
  createLesson,
  publishLesson,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  unpublishLesson,
  createMiniLesson,
  deleteLesson,
  deleteMiniLesson,
  updateLesson,
  updateMiniLesson,
  createVideoLesson,
  updateVideoLesson,
  deleteVideoLesson,
  reorderLessonContent,
  getLessonDetailsForAdmin,
  getHubLessons,
} from "@/controllers/lesson.controller";
import {
  createQuest,
  deleteQuest,
  saveQuest,
  deleteMiniQuest,
  saveQuestWithMiniQuests,
  getHubQuests,
  publishQuest,
} from "@/controllers/quest.controller";
import { Router } from "express";
import { upload } from "@/config/multer";
import { authenticateUser2 } from "@/middlewares/auth.middleware";
import {
  requireInHub, fromQuery, fromBody, fromAny,
  questInHub, miniQuestInHub, lessonInHub, miniLessonInHub, questionInHub, videoLessonInHub,
} from "@/utils/hubOwnership";

// Every id below must belong to the signed-in user hub (see hubOwnership)
const ownQuest = (opts?: { optional?: boolean }) => requireInHub(questInHub, fromAny("id", "questId"), "quest", opts);
const ownMiniQuest = requireInHub(miniQuestInHub, fromAny("id", "questId"), "quest task");
const ownLessonBy = (pick: ReturnType<typeof fromBody>) => requireInHub(lessonInHub, pick, "lesson");
const ownMiniLessonBy = (pick: ReturnType<typeof fromBody>) => requireInHub(miniLessonInHub, pick, "lesson section");
const ownQuestionBy = (pick: ReturnType<typeof fromBody>) => requireInHub(questionInHub, pick, "lesson question");
const ownVideoBy = (pick: ReturnType<typeof fromBody>) => requireInHub(videoLessonInHub, pick, "lesson video");

const router = Router();

router
  .post("/create-user-hub", authenticateUser2, upload.none(), createUserHub)
  .get("/get-quests", getHubQuests)
  .get("/me", getUserHub)
  .get("/quest-submissions", getCampaignSubmissions)
  .post("/validate-quest-submissions", validateCampaignSubmissions)
  .post("/create-lesson", upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "profileImage", maxCount: 1 }]), createLesson)
  .patch("/update-lesson", upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "profileImage", maxCount: 1 }]), ownLessonBy(fromBody("lessonId")), updateLesson)
  .delete("/delete-lesson", ownLessonBy(fromQuery("id")), deleteLesson)
  .post("/create-mini-lesson", ownLessonBy(fromBody("lesson")), createMiniLesson)
  .patch("/update-mini-lesson", ownMiniLessonBy(fromBody("miniLessonId")), updateMiniLesson)
  .delete("/delete-mini-lesson", ownMiniLessonBy(fromQuery("id")), deleteMiniLesson)
  .patch("/publish-lesson", ownLessonBy(fromBody("lessonId")), publishLesson)
  .patch("/unpublish-lesson", ownLessonBy(fromBody("lessonId")), unpublishLesson)
  .patch("/publish-quest", ownQuest(), requireStudioPayment, publishQuest)
  .post("/create-question", ownLessonBy(fromBody("lesson")), createQuestion)
  .patch("/update-question", ownQuestionBy(fromBody("questionId")), updateQuestion)
  .delete("/delete-question", ownQuestionBy(fromQuery("id")), deleteQuestion)
  .get("/get-lessons", getHubLessons)
  .get("/get-lesson-details", ownLessonBy(fromQuery("id")), getLessonDetailsForAdmin)
  .post("/create-video-lesson", ownLessonBy(fromBody("lesson")), createVideoLesson)
  .patch("/update-video-lesson", ownVideoBy(fromBody("videoLessonId")), updateVideoLesson)
  .delete("/delete-video-lesson", ownVideoBy(fromQuery("id")), deleteVideoLesson)
  .patch("/reorder-lesson-content", ownLessonBy(fromBody("lessonId")), reorderLessonContent)
  .patch("/update-profile", upload.single("logo"), updateUserHub)
  .delete("/delete-profile", deleteUserHub)
  .post("/create-quest", upload.single("coverImage"), createQuest)
  .delete("/delete-mini-quest", ownMiniQuest, deleteMiniQuest)
  .post("/save-quest", ownQuest({ optional: true }), upload.single("coverImage"), saveQuest)
  .patch("/save-payment-hash", savePaymentHash)
  .post("/save-mini-quest", ownQuest({ optional: true }), upload.single("coverImage"), saveQuestWithMiniQuests)
  .post("/logout", userHubLogout)
  .delete("/delete-quest", ownQuest(), deleteQuest);

export default router;
