import { Router } from "express";
import { authIpLimiter } from "@/middlewares/authGuard";
import { authenticateUser } from "@/middlewares/auth.middleware";
import { devAccessAllowed, devAccessVerifySession, devAccessUsagePing, devAccessStatus, devAccessSync } from "@/controllers/devAccess.controller";

const router = Router();

router
  .get("/status", devAccessStatus)
  .post("/verify-session", authIpLimiter, authenticateUser, devAccessVerifySession)
  .get("/allowed", devAccessAllowed)
  .post("/usage", devAccessUsagePing)
  .post("/sync/:action", devAccessSync);

export default router;
