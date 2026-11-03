import { Router } from "express";
import { authIpLimiter } from "@/middlewares/authGuard";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { devAccessAllowed, devAccessCheck, devAccessVerifySession, devAccessUsagePing, devAccessChallenge, devAccessStatus, devAccessSync, devAccessVerify } from "@/controllers/devAccess.controller";

const router = Router();

router
  .get("/status", devAccessStatus)
  .get("/challenge", authIpLimiter, devAccessChallenge)
  .post("/verify", authIpLimiter, devAccessVerify)
  .post("/verify-session", authIpLimiter, authenticateUser, devAccessVerifySession)
  .get("/allowed", devAccessAllowed)
  .get("/check", authIpLimiter, devAccessCheck)
  .post("/usage", devAccessUsagePing)
  .post("/sync/:action", devAccessSync);

export default router;
