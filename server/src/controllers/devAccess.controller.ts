import { createHmac, timingSafeEqual } from "crypto";
import { verifyMessage, isAddress } from "ethers";
import logger from "@/config/logger";
import { JWT_SECRET } from "@/utils/env.utils";
import { devAccess } from "@/models/devAccess.model";
import { admin } from "@/models/admin.model";
import { BAD_REQUEST, CONFLICT, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK, UNAUTHORIZED } from "@/utils/status.utils";
import {
  DEV_ACCESS_SYNC_HEADER, DEV_ACCESS_SYNC_KEY, ListError, clearDevAccessCache, forwardToList, holdsList,
  isGatedHost, isWhitelisted, isWhitelistedLocally, readDevAccess, signDevAccessToken,
} from "@/middlewares/devAccess.middleware";

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const proof = (address: string, issued: string) => createHmac("sha256", JWT_SECRET).update(`dev-access:${address}:${issued}`).digest("hex").slice(0, 24);
const challengeText = (address: string, issued: string) =>
  `Sign in to the Nexura test app\n\nWallet: ${address}\nIssued: ${issued}\nCode: ${proof(address, issued)}`;
const sameKey = (a: string, b: string) => {
  const [left, right] = [Buffer.from(a), Buffer.from(b)];
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
};

export const devAccessStatus = async (req: GlobalRequest, res: GlobalResponse) => {
  const enabled = isGatedHost(req);
  const address = enabled ? await readDevAccess(req) : null;
  res.status(OK).json({ enabled, access: address ? { address } : null });
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
    res.status(OK).json({ token: signDevAccessToken(address, req.body?.remember !== false), access: { address } });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "sign-in failed" });
  }
};

/** GET /dev-access/check?address=: whether a wallet is on the whitelist, before it signs (asks the main API). */
export const devAccessCheck = async (req: GlobalRequest, res: GlobalResponse) => {
  const address = String(req.query.address ?? "").trim().toLowerCase();
  if (!isAddress(address)) {
    res.status(BAD_REQUEST).json({ error: "send a valid wallet address" });
    return;
  }
  clearDevAccessCache(address);
  res.status(OK).json({ allowed: await isWhitelisted(address) });
};

export const devAccessAllowed = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    res.status(OK).json({ allowed: await isWhitelistedLocally(String(req.query.address ?? "")) });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "could not check the wallet" });
  }
};

// Whitelist actions for dashboard admins. They only run on the server that holds
// the list; the gated server forwards them there with the admin's name attached.

// "seen" is only sent by the gated server (sync key), when a whitelisted wallet uses the test app
type Action = "list" | "check" | "add" | "remove" | "update" | "seen";
const ACTIONS: Action[] = ["list", "check", "add", "remove", "update", "seen"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
const cleanName = (v: unknown) => String(v ?? "").trim().slice(0, 60);

// Admins of the Nexura dashboard, by email: the only people who can be allowed to invite others.
async function dashboardAdmins(): Promise<Map<string, string>> {
  const members = new Map<string, string>();
  const rows = await admin.find({ verified: true }, { email: 1, username: 1 }).lean() as { email?: string; username?: string }[];
  for (const a of rows) if (a.email) members.set(String(a.email).toLowerCase(), String(a.username ?? "") || String(a.email).split("@")[0]!);
  return members;
}

const toEntry = (r: any, members: Map<string, string>) => ({
  address: r.address,
  label: r.label ?? "",
  email: r.email ?? "",
  addedBy: r.addedBy ?? "",
  dashboardAdmin: !!r.email && members.has(r.email),
  canInvite: !!r.canInvite && !!r.email && members.has(r.email),
  addedAt: r.createdAt,
  lastSeenAt: r.lastSeenAt ?? null,
});

async function runAction(action: Action, body: any, adminName: string) {
  if (action === "list") {
    const [rows, members] = await Promise.all([devAccess.find().sort({ createdAt: -1 }).lean(), dashboardAdmins()]);
    return { entries: (rows as any[]).map(r => toEntry(r, members)) };
  }

  if (action === "check") {
    const email = cleanEmail(body?.email);
    const members = await dashboardAdmins();
    return { dashboardAdmin: members.has(email), memberName: members.get(email) ?? "" };
  }

  const address = String(body?.address ?? "").trim().toLowerCase();
  if (!isAddress(address)) throw new ListError("enter a valid wallet address", BAD_REQUEST);

  if (action === "add") {
    const label = cleanName(body?.label);
    const email = cleanEmail(body?.email);
    if (!label) throw new ListError("a name is required", BAD_REQUEST);
    if (!EMAIL_RE.test(email)) throw new ListError("enter a valid email", BAD_REQUEST);
    if (await devAccess.exists({ address })) throw new ListError("this wallet already has access", CONFLICT);
    const canInvite = !!body?.canInvite;
    if (canInvite && !(await dashboardAdmins()).has(email)) {
      throw new ListError("only Nexura dashboard admins can be allowed to invite others", BAD_REQUEST);
    }
    await devAccess.create({ address, label, email, canInvite, addedBy: adminName });
    clearDevAccessCache(address);
    return { added: 1 };
  }

  if (action === "seen") {
    await devAccess.updateOne({ address }, { $set: { lastSeenAt: new Date() } });
    return { seen: 1 };
  }

  if (action === "remove") {
    const { deletedCount } = await devAccess.deleteOne({ address });
    if (!deletedCount) throw new ListError("this wallet isn't on the whitelist", NOT_FOUND);
    clearDevAccessCache(address);
    return { removed: 1 };
  }

  if (action === "update") {
    const row = await devAccess.findOne({ address }).lean() as any;
    if (!row) throw new ListError("this wallet isn't on the whitelist", NOT_FOUND);
    const set: Record<string, unknown> = {};
    if (body?.label !== undefined) {
      set.label = cleanName(body.label);
      if (!set.label) throw new ListError("a name is required", BAD_REQUEST);
    }
    if (body?.email !== undefined) {
      set.email = cleanEmail(body.email);
      if (!EMAIL_RE.test(String(set.email))) throw new ListError("enter a valid email", BAD_REQUEST);
    }
    const email = String(set.email ?? row.email ?? "");
    const isMember = (await dashboardAdmins()).has(email);
    if (typeof body?.canInvite === "boolean") {
      if (body.canInvite && !isMember) throw new ListError("only Nexura dashboard admins can be allowed to invite others", BAD_REQUEST);
      set.canInvite = body.canInvite;
    }
    if (!isMember) set.canInvite = false;
    await devAccess.updateOne({ address }, { $set: set });
    clearDevAccessCache(address);
    return { updated: 1 };
  }

  throw new ListError("unknown action", NOT_FOUND);
}

// Dashboard admins, from either dashboard.
export const adminDevAccess = (action: Action) => async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const body = action === "list" ? {} : (req.body ?? {});
    const adminName = req.adminName ?? "Admin";
    const result = holdsList(req) ? await runAction(action, body, adminName) : await forwardToList(action, { ...body, adminName });
    if (action !== "list" && action !== "check") clearDevAccessCache();
    res.status(OK).json(result);
  } catch (error) {
    if (error instanceof ListError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "could not update the whitelist" });
  }
};

// Called by the gated server; only answered by the server that holds the list.
export const devAccessSync = async (req: GlobalRequest, res: GlobalResponse) => {
  if (!holdsList(req) || !sameKey(String(req.header(DEV_ACCESS_SYNC_HEADER) ?? ""), DEV_ACCESS_SYNC_KEY)) {
    res.status(FORBIDDEN).json({ error: "the test app server's DEV_ACCESS_SYNC_KEY doesn't match the main API's" });
    return;
  }
  const action = String(req.params.action) as Action;
  if (!ACTIONS.includes(action)) {
    res.status(BAD_REQUEST).json({ error: "bad sync request" });
    return;
  }
  try {
    res.status(OK).json(await runAction(action, req.body ?? {}, String(req.body?.adminName ?? "Admin").slice(0, 80)));
  } catch (error) {
    if (error instanceof ListError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "could not update the whitelist" });
  }
};
