import { Router } from "express";
import { authIpLimiter } from "@/middlewares/authGuard";
import { devAccessAllowed, devAccessChallenge, devAccessStatus, devAccessVerify } from "@/controllers/devAccess.controller";

const router = Router();

router
  .get("/status", devAccessStatus)
  .get("/challenge", authIpLimiter, devAccessChallenge)
  .post("/verify", authIpLimiter, devAccessVerify)
  .get("/allowed", devAccessAllowed);

export default router;
