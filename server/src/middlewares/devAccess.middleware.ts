import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import logger from "@/config/logger";
import { JWT_SECRET } from "@/utils/env.utils";
import { JWT } from "@/utils/utils";
import { BAD_REQUEST, FORBIDDEN } from "@/utils/status.utils";
import { admin } from "@/models/admin.model";
import { devAccess } from "@/models/devAccess.model";

export const DEV_ACCESS_ENABLED = process.env.DEV_ACCESS_ENABLED === "true";
export const DEV_ACCESS_HEADER = "x-dev-access";
const DEV_ACCESS_PURPOSE = "dev-access";
const LIST_URL = String(process.env.DEV_ACCESS_LIST_URL ?? "").replace(/\/+$/, "");
export const DEV_ACCESS_SYNC_KEY = String(process.env.DEV_ACCESS_SYNC_KEY ?? "");

const CACHE_MS = 10_000;
const cache = new Map<string, { allowed: boolean; at: number }>();
export const clearDevAccessCache = (address?: string) => (address ? cache.delete(address.toLowerCase()) : cache.clear());

export const isWhitelistedLocally = async (address: string) =>
  !!(await devAccess.exists({ address: address.toLowerCase() }));

export async function isWhitelisted(address: string): Promise<boolean> {
  const addr = address.toLowerCase();
  const hit = cache.get(addr);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.allowed;
  let allowed = false;
  if (LIST_URL) {
    try {
      const res = await axios.get(`${LIST_URL}/api/dev-access/allowed`, { params: { address: addr }, headers: { "x-dev-access-key": DEV_ACCESS_SYNC_KEY }, timeout: 8_000 });
      allowed = !!res.data?.allowed;
    } catch (error) {
      logger.error(error);
      return hit?.allowed ?? false;
    }
  } else {
    allowed = await isWhitelistedLocally(addr);
  }
  cache.set(addr, { allowed, at: Date.now() });
  return allowed;
}

export const signDevAccessToken = (address: string) =>
  jwt.sign({ purpose: DEV_ACCESS_PURPOSE, address: address.toLowerCase() }, JWT_SECRET, { expiresIn: "7d" });

export async function readDevAccess(req: Request): Promise<string | null> {
  const token = req.header(DEV_ACCESS_HEADER);
  if (!token) return null;
  try {
    const claims = jwt.verify(token, JWT_SECRET) as { purpose?: string; address?: string };
    if (claims.purpose !== DEV_ACCESS_PURPOSE || !claims.address) return null;
    return (await isWhitelisted(claims.address)) ? claims.address : null;
  } catch {
    return null;
  }
}

const isDashboardAdmin = async (req: Request) => {
  const token = req.header("authorization")?.split(" ")[1];
  if (!token) return false;
  try {
    const { id } = await JWT.verify(token) as { id?: string };
    return !!id && !!(await admin.exists({ _id: id }));
  } catch {
    return false;
  }
};

const OPEN_PATHS = [/^\/dev-access(\/|$)/, /^\/admin(\/|$)/, /callback/i, /connect-discord/i, /^\/server-time$/];

export async function devAccessGate(req: Request, res: Response, next: NextFunction) {
  if (!DEV_ACCESS_ENABLED || req.method === "OPTIONS" || OPEN_PATHS.some(p => p.test(req.path))) return next();
  if (await readDevAccess(req) || await isDashboardAdmin(req)) return next();
  res.setHeader(DEV_ACCESS_HEADER, "denied");
  res.status(FORBIDDEN).json({ error: "This test app is private. Sign in with a whitelisted wallet." });
}

export function requireListHere(_req: Request, res: Response, next: NextFunction) {
  if (!LIST_URL) return next();
  res.status(BAD_REQUEST).json({ error: "Manage the test app whitelist from the main admin dashboard." });
}
