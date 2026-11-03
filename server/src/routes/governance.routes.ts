import { Router } from "express";
import {
  checkGovernanceProposal,
  createGovernanceProposal,
  executeGovernanceProposal,
  getGovernance,
  markGovernanceNotificationsRead,
  voteOnGovernanceProposal,
} from "@/controllers/governance.controller";

// Mounted at /hub/governance behind authenticateHubAdmin2 (any hub admin).
// Role and signer checks happen in the controller.
const router = Router();

router
  .get("/", getGovernance)
  .post("/proposals", createGovernanceProposal)
  .post("/proposals/check", checkGovernanceProposal)
  .post("/proposals/:ref/vote", voteOnGovernanceProposal)
  .post("/proposals/:ref/execute", executeGovernanceProposal)
  .post("/notifications/read", markGovernanceNotificationsRead);

export default router;
