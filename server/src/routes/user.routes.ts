import { Router } from "express";
import {
	fetchUser,
	referralInfo,
  updateUser,
  claimDepositXp,
	claimReferreralReward,
	updateBadge,
	performDailySignIn,
	setApproved,
	updateClaims,
	updateClaimsCreated,
  claimStreakReward,
  fetchDailyXpDetails,
  restoreStreak,
  getUserXpHistory,
  getUserPNL,
  getPositions,
  getIntuitionAccountActivity
} from "@/controllers/app.controller";
import { logout } from "@/controllers/auth.controller";
import { upload } from "@/config/multer";
import { upload as safeUpload } from "@/middlewares/auth.middleware";
import { markMyFeedbackSeen, myFeedback, replyToMyFeedback, submitFeedback } from "@/controllers/feedback.controller";

const router = Router();

router
  .get("/profile", fetchUser)
  .get("/get-intuition-pnl", getUserPNL)
  .get("/get-intuition-positions", getPositions)
  .get("/get-intuition-activity", getIntuitionAccountActivity)
  .post("/claim-referral-reward", claimReferreralReward)
  .patch("/update-badge", updateBadge)
  .post("/claim-deposit-xp", claimDepositXp)
  .post("/update-claims", updateClaims)
  .post("/update-claims-created", updateClaimsCreated)
  .post("/set-approved", setApproved)
  .post("/claim-streak-reward", claimStreakReward)
  .get("/xp-history", getUserXpHistory)
  .get("/daily-xp-details", fetchDailyXpDetails)
  .post("/restore-streak", restoreStreak)
  .get("/referral-info", referralInfo)
  .post("/logout", logout)
  .post("/perform-daily-sign-in", performDailySignIn)
  .patch("/update", upload.single("profilePic"), updateUser)
  .post("/feedback", ...safeUpload.array("attachments", 3), submitFeedback("app"))
  .get("/feedback", myFeedback("app"))
  .post("/feedback/reply", replyToMyFeedback("app"))
  .post("/feedback/seen", markMyFeedbackSeen("app"));

export default router;
