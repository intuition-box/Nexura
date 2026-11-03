import { Router } from "express";
import { authIpLimiter } from "@/middlewares/authGuard";
import { devAccessAllowed, devAccessCheck, devAccessChallenge, devAccessStatus, devAccessSync, devAccessVerify } from "@/controllers/devAccess.controller";

const router = Router();

router
  .get("/status", devAccessStatus)
  .get("/challenge", authIpLimiter, devAccessChallenge)
  .post("/verify", authIpLimiter, devAccessVerify)
  .get("/allowed", devAccessAllowed)
  .get("/check", authIpLimiter, devAccessCheck)
  .post("/sync/:action", devAccessSync);

export default router;
