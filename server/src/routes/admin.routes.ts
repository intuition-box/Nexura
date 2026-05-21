import { Router } from "express";
import {
  addAdmin,
  adminLogout,
  rewardXp,
  rewardXpBatch,
  banUser,
  unBanUser,
  getBannedUsers,
  createQuest,
  getAdmins,
  resendAdminInvite,
  deleteAdminInvite,
  getTasks,
  getUserSummary,
  getAdminLeaderboard,
  markTask,
  removeAdmin,
  manageAdmin,
  getStudioCampaigns,
  getXpHistory,
  deleteStudioCampaign,
  getDeletedStudioCampaigns,
  restoreStudioCampaign,
  permanentlyDeleteStudioCampaign,
  getAdminHubQuests,
  getAdminQuestDetail,
  getStudioQuests,
  getStudioLessons,
  searchUserXpHistory,
  publishAdminQuest,
  deleteQuestAdmin,
  deleteLessonAdmin,
  deleteStudioQuest,
  getDeletedStudioQuests,
  restoreStudioQuest,
  permanentlyDeleteStudioQuest,
  deleteStudioLesson,
  getDeletedStudioLessons,
  restoreStudioLesson,
  permanentlyDeleteStudioLesson,
} from "@/controllers/admin.controller";
import { deleteQuest, saveQuest } from "@/controllers/quest.controller";
import { fetchChannels, fetchRoles, fetchServers } from "@/controllers/hub.auth.controller";
import { disconnectHubDiscord, getCampaign, getHub, saveCampaign, saveCampaignWithQuests, updateHub } from "@/controllers/hub.controller";
import {
  createLesson,
  deleteLesson,
  deleteMiniLesson,
  deleteQuestion,
  createQuestion,
  createMiniLesson,
  createVideoLesson,
  updateVideoLesson,
  deleteVideoLesson,
  getAllLessons,
  getAdminLessons,
  getLessonById,
  getLessonDetailsForAdmin,
  updateLesson,
  updateMiniLesson,
  updateQuestion,
  reorderLessonContent,
  publishLesson,
  unpublishLesson,
  updateQuestionIntro,
} from "@/controllers/lesson.controller";
import { upload } from "@/config/multer";
import { attachAdminCampaignHub, requireAdminSuperadmin } from "@/middlewares/auth.middleware";
import { publishAdminCampaign } from "@/controllers/adminCampaign.controller";
import { noPaymentRequired } from "@/controllers/adminPublish.controller";
import { addCampaignAddress, closeCampaign, deleteCampaign, fetchHubCampaigns, recordCampaignRewardsWithdrawal, reopenCampaign } from "@/controllers/campaign.controller";

const router = Router();

router
  .post("/create-quest", createQuest)
  .post("/validate-task", markTask)
  .post("/add-admin", addAdmin)
  .post("/resend-invite", resendAdminInvite)
  .delete("/delete-invite", deleteAdminInvite)
  .post("/logout", adminLogout)
  .post("/remove-admin", removeAdmin)
  .post("/manage-admin", manageAdmin)
  .post("/reward-xp", rewardXp)
  .post("/reward-xp-batch", rewardXpBatch)
  .post("/search-xp-history", searchUserXpHistory)
  .post("/ban-user", banUser)
  .post("/unban-user", unBanUser)
  .get("/me", attachAdminCampaignHub, getHub)
  .patch("/update-hub", requireAdminSuperadmin, attachAdminCampaignHub, upload.fields([{ name: "logo", maxCount: 1 }, { name: "document", maxCount: 1 }]), updateHub)
  .patch("/disconnect-discord", requireAdminSuperadmin, attachAdminCampaignHub, disconnectHubDiscord)
  .get("/get-campaigns", attachAdminCampaignHub, fetchHubCampaigns)
  .get("/get-campaign", attachAdminCampaignHub, getCampaign)
  .get("/get-roles", fetchRoles)
  .get("/get-channels", fetchChannels)
  .get("/get-servers", fetchServers)
  .patch("/save-campaign", requireAdminSuperadmin, attachAdminCampaignHub, upload.single("coverImage"), saveCampaign)
  .patch("/save-campaign-quests", requireAdminSuperadmin, attachAdminCampaignHub, upload.single("coverImage"), saveCampaignWithQuests)
  .patch("/add-campaign-address", requireAdminSuperadmin, attachAdminCampaignHub, addCampaignAddress)
  .patch("/publish-campaign", requireAdminSuperadmin, attachAdminCampaignHub, noPaymentRequired, publishAdminCampaign)
  .patch("/publish-quest", requireAdminSuperadmin, attachAdminCampaignHub, noPaymentRequired, publishAdminQuest)
  .patch("/save-quest", requireAdminSuperadmin, attachAdminCampaignHub, upload.single("coverImage"), saveQuest)
  .delete("/delete-campaign", requireAdminSuperadmin, attachAdminCampaignHub, deleteCampaign)
  .delete("/delete-quest", requireAdminSuperadmin, attachAdminCampaignHub, deleteQuest)
  .delete("/delete-fraud-quest", requireAdminSuperadmin, deleteQuestAdmin)
  .delete("/delete-fraud-lesson", requireAdminSuperadmin, deleteLessonAdmin)
  .patch("/close-campaign", requireAdminSuperadmin, attachAdminCampaignHub, closeCampaign)
  .patch("/reopen-campaign", requireAdminSuperadmin, attachAdminCampaignHub, reopenCampaign)
  .patch("/record-campaign-rewards-withdrawal", requireAdminSuperadmin, attachAdminCampaignHub, recordCampaignRewardsWithdrawal)
  .post("/create-lesson", upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "profileImage", maxCount: 1 }]), createLesson)
  .delete("/delete-lesson", deleteLesson)
  .patch("/update-lesson", upload.fields([{ name: "coverImage", maxCount: 1 }, { name: "profileImage", maxCount: 1 }]), updateLesson)
  .post("/create-mini-lesson", createMiniLesson)
  .patch("/update-mini-lesson", updateMiniLesson)
  .delete("/delete-mini-lesson", deleteMiniLesson)
  .post("/create-question", createQuestion)
  .patch("/update-question", updateQuestion)
  .delete("/delete-question", deleteQuestion)
  .post("/create-video-lesson", createVideoLesson)
  .patch("/update-video-lesson", updateVideoLesson)
  .delete("/delete-video-lesson", deleteVideoLesson)
  .patch("/reorder-lesson-content", reorderLessonContent)
  .patch("/publish-lesson", publishLesson)
  .patch("/unpublish-lesson", unpublishLesson)
  .patch("/update-question-intro", updateQuestionIntro)
  .get("/get-lesson-by-id", getLessonById)
  .get("/get-lesson-details", getLessonDetailsForAdmin)
  .get("/get-all-lessons", getAllLessons)
  .get("/get-admin-lessons", getAdminLessons)
  .get("/get-banned-users", getBannedUsers)
  .get("/get-xp-history", getXpHistory)
  .get("/get-admins", getAdmins)
  .get("/get-admin-quests", attachAdminCampaignHub, getAdminHubQuests)
  .get("/get-quest-detail", attachAdminCampaignHub, getAdminQuestDetail)
  .get("/get-quests", attachAdminCampaignHub, getTasks)
  .get("/user-summary", getUserSummary)
  .get("/leaderboard", getAdminLeaderboard)
  .get("/get-lessons", getStudioLessons)
  .get("/studio-campaigns", getStudioCampaigns)
  .get("/deleted-studio-campaigns", getDeletedStudioCampaigns)
  .delete("/studio-campaigns", deleteStudioCampaign)
  .patch("/restore-studio-campaign", restoreStudioCampaign)
  .delete("/permanent-studio-campaign", permanentlyDeleteStudioCampaign)
  .get("/studio-quests", getStudioQuests)
  .delete("/studio-quests", deleteStudioQuest)
  .get("/deleted-studio-quests", getDeletedStudioQuests)
  .patch("/restore-studio-quest", restoreStudioQuest)
  .delete("/permanent-studio-quest", permanentlyDeleteStudioQuest)
  .get("/studio-lessons", getStudioLessons)
  .delete("/studio-lessons", deleteStudioLesson)
  .get("/deleted-studio-lessons", getDeletedStudioLessons)
  .patch("/restore-studio-lesson", restoreStudioLesson)
  .delete("/permanent-studio-lesson", permanentlyDeleteStudioLesson);

export default router;
