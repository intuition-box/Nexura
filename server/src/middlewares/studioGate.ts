import type { NextFunction, Request, Response } from "express";
import logger from "@/config/logger";
import { environment } from "@/utils/env.utils";
import { FORBIDDEN } from "@/utils/status.utils";
import { isGatedHost } from "@/middlewares/devAccess.middleware";

/*
 * Server side of the app's "Studio is being upgraded" screen: Studio routes only answer on the test
 * app (staging-api), locally, or where STUDIO_LIVE is "true". Otherwise calling the API directly
 * can't sign up a studio or publish a campaign either.
 */
const STUDIO_LIVE = process.env.STUDIO_LIVE?.trim().toLowerCase() === "true";
if (!STUDIO_LIVE && environment !== "development") {
  logger.warn("STUDIO_LIVE isn't \"true\": Nexura Studio routes are closed on this server (open on the test app). Set it to true to open Studio.");
}

export const studioOpen = (req: Request) => STUDIO_LIVE || environment === "development" || isGatedHost(req);

export const studioGate = (req: Request, res: Response, next: NextFunction) => {
  if (studioOpen(req)) { next(); return; }
  res.status(FORBIDDEN).json({ error: "Nexura Studio is being upgraded and isn't open yet.", studioClosed: true });
};
