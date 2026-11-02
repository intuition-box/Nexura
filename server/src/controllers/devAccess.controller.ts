import { createHmac, timingSafeEqual } from "crypto";
import { verifyMessage, isAddress } from "ethers";
import logger from "@/config/logger";
import { JWT_SECRET } from "@/utils/env.utils";
import { devAccess } from "@/models/devAccess.model";
import { BAD_REQUEST, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK, UNAUTHORIZED } from "@/utils/status.utils";
import { DEV_ACCESS_ENABLED, DEV_ACCESS_SYNC_KEY, clearDevAccessCache, isWhitelisted, isWhitelistedLocally, readDevAccess, signDevAccessToken } from "@/middlewares/devAccess.middleware";

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const proof = (address: string, issued: string) => createHmac("sha256", JWT_SECRET).update(`dev-access:${address}:${issued}`).digest("hex").slice(0, 24);
const challengeText = (address: string, issued: string) =>
  `Sign in to the Nexura test app\n\nWallet: ${address}\nIssued: ${issued}\nCode: ${proof(address, issued)}`;
const sameKey = (a: string, b: string) => {
  const [left, right] = [Buffer.from(a), Buffer.from(b)];
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
};

export const devAccessStatus = async (req: GlobalRequest, res: GlobalResponse) => {
  const address = DEV_ACCESS_ENABLED ? await readDevAccess(req) : null;
  res.status(OK).json({ enabled: DEV_ACCESS_ENABLED, access: address ? { address } : null });
};

export const devAccessChallenge = async (req: GlobalRequest, res: GlobalResponse) => {
  const address = String(req.query.address ?? "").trim().toLowerCase();
  if (!isAddress(address)) {
    res.status(BAD_REQUEST).json({ error: "send a valid wallet address" });
    return;
  }
  res.status(OK).json({ message: challengeText(address, new Date().toISOString()) });
};

export const devAccessVerify = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const { message, signature } = req.body as { message?: string; signature?: string };
    const match = String(message ?? "").match(/^Sign in to the Nexura test app\n\nWallet: (0x[0-9a-f]{40})\nIssued: (\S+)\nCode: ([0-9a-f]{24})$/);
    if (!match || !signature) {
      res.status(BAD_REQUEST).json({ error: "send the signed message and signature" });
      return;
    }
    const [address, issued, code] = [match[1]!, match[2]!, match[3]!];
    const age = Date.now() - new Date(issued).getTime();
    if (!(age >= 0 && age < CHALLENGE_TTL_MS) || !sameKey(proof(address, issued), code)) {
      res.status(BAD_REQUEST).json({ error: "this sign-in request expired, try again" });
      return;
    }
    let signer = "";
    try { signer = verifyMessage(String(message), String(signature)).toLowerCase(); } catch { /* bad signature */ }
    if (signer !== address) {
      res.status(UNAUTHORIZED).json({ error: "the signature doesn't match this wallet" });
      return;
    }
    clearDevAccessCache(address);
    if (!(await isWhitelisted(address))) {
      res.status(FORBIDDEN).json({ error: "this wallet isn't on the test app whitelist" });
      return;
    }
    res.status(OK).json({ token: signDevAccessToken(address), access: { address } });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "sign-in failed" });
  }
};

export const devAccessAllowed = async (req: GlobalRequest, res: GlobalResponse) => {
  if (!sameKey(String(req.header("x-dev-access-key") ?? ""), DEV_ACCESS_SYNC_KEY)) {
    res.status(FORBIDDEN).json({ error: "not allowed" });
    return;
  }
  try {
    res.status(OK).json({ allowed: await isWhitelistedLocally(String(req.query.address ?? "")) });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "could not check the wallet" });
  }
};

export const listDevAccess = async (_req: GlobalRequest, res: GlobalResponse) => {
  try {
    const rows = await devAccess.find().sort({ createdAt: -1 }).lean() as any[];
    res.status(OK).json({ entries: rows.map(r => ({ address: r.address, label: r.label, addedBy: r.addedBy, addedAt: r.createdAt })) });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "could not load the whitelist" });
  }
};

export const addDevAccess = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const address = String(req.body?.address ?? "").trim().toLowerCase();
    if (!isAddress(address)) {
      res.status(BAD_REQUEST).json({ error: "send a valid wallet address" });
      return;
    }
    const label = String(req.body?.label ?? "").trim().slice(0, 60);
    await devAccess.updateOne({ address }, { $set: { label }, $setOnInsert: { addedBy: req.adminName ?? "Admin" } }, { upsert: true });
    clearDevAccessCache(address);
    res.status(OK).json({ message: "added" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "could not add the wallet" });
  }
};

export const removeDevAccess = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const address = String(req.body?.address ?? "").trim().toLowerCase();
    const { deletedCount } = await devAccess.deleteOne({ address });
    if (!deletedCount) {
      res.status(NOT_FOUND).json({ error: "this wallet isn't on the whitelist" });
      return;
    }
    clearDevAccessCache(address);
    res.status(OK).json({ message: "removed" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "could not remove the wallet" });
  }
};
