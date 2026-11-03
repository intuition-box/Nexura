import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import logger from "@/config/logger";
import { JWT_SECRET } from "@/utils/env.utils";
import { JWT } from "@/utils/utils";
import { FORBIDDEN } from "@/utils/status.utils";
import { admin } from "@/models/admin.model";
import { devAccess } from "@/models/devAccess.model";

// The test app (dev.nexura.intuition.box) talks to staging-api, which is gated.
// The whitelist itself lives on the main API so both dashboards edit one list:
// staging forwards reads and writes to it, signed with DEV_ACCESS_SYNC_KEY.
const GATED_HOST = "staging-api.nexura.intuition.box";
const MAIN_API_URL = "https://api.nexura.intuition.box";
export const isGatedHost = (req: Request) =>
  process.env.DEV_ACCESS_ENABLED === "true" || req.header("host")?.split(":")[0]?.toLowerCase() === GATED_HOST;
export const holdsList = (req: Request) => !isGatedHost(req);
export const DEV_ACCESS_HEADER = "x-dev-access";
export const DEV_ACCESS_SYNC_HEADER = "x-dev-access-key";
export const DEV_ACCESS_SYNC_KEY = String(process.env.DEV_ACCESS_SYNC_KEY ?? "");
const DEV_ACCESS_PURPOSE = "dev-access";
const LIST_URL = String(process.env.DEV_ACCESS_LIST_URL ?? MAIN_API_URL).replace(/\/+$/, "");

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
  try {
    const res = await axios.get(`${LIST_URL}/api/dev-access/allowed`, { params: { address: addr }, timeout: 8_000 });
    allowed = !!res.data?.allowed;
  } catch (error) {
    logger.error(error);
    return hit?.allowed ?? false;
  }
  cache.set(addr, { allowed, at: Date.now() });
  return allowed;
}

export class ListError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// Runs a whitelist action on the main API from the gated server.
export async function forwardToList<T>(action: string, body: Record<string, unknown>): Promise<T> {
  if (!DEV_ACCESS_SYNC_KEY) throw new ListError("DEV_ACCESS_SYNC_KEY isn't set on this server, so it can't reach the shared whitelist.", 503);
  try {
    const res = await axios.post(`${LIST_URL}/api/dev-access/sync/${action}`, body, {
      headers: { [DEV_ACCESS_SYNC_HEADER]: DEV_ACCESS_SYNC_KEY },
      timeout: 10_000,
    });
    return res.data as T;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new ListError(error.response.data?.error || "The shared whitelist refused the request.", error.response.status);
    }
    logger.error(error);
    throw new ListError("Couldn't reach the shared whitelist. Try again in a moment.", 502);
  }
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
  if (!isGatedHost(req) || req.method === "OPTIONS" || OPEN_PATHS.some(p => p.test(req.path))) return next();
  if (await readDevAccess(req) || await isDashboardAdmin(req)) return next();
  res.setHeader(DEV_ACCESS_HEADER, "denied");
  res.status(FORBIDDEN).json({ error: "This test app is private. Sign in with a whitelisted wallet." });
}
