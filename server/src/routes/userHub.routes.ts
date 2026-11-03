import { authenticateUser, authenticateUserHub } from '@/middlewares/auth.middleware';
import userHubAppRoutes from './userHub.app.routes';
import { Router } from 'express';
import { attemptGuard, authIpLimiter, codeSendLimiter } from "@/middlewares/authGuard";
import { userHubAdminSignUp, userHubSignIn, userHubResetPassword, userHubForgotPassword } from '@/controllers/hub.auth.controller';
import { getUserProfileByWallet } from '@/controllers/hub.controller';

const router = Router();

router
  .get("/profile-by-wallet", getUserProfileByWallet)
  // Sign-in and code checks are rate limited and lock out after repeated wrong attempts (see authGuard)
  .post("/sign-in", authIpLimiter, attemptGuard("user-hub-login"), userHubSignIn)
  .post("/sign-up", authIpLimiter, userHubAdminSignUp)
  .post("/forgot-password", codeSendLimiter, userHubForgotPassword)
  .post("/reset-password", authIpLimiter, attemptGuard("user-hub-reset"), userHubResetPassword)
  .use("/", authenticateUserHub, userHubAppRoutes);

export default router;
