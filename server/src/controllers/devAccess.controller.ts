import { timingSafeEqual } from "crypto";
import { isAddress } from "ethers";
import logger from "@/config/logger";
import { devAccess } from "@/models/devAccess.model";
import { admin } from "@/models/admin.model";
import { BAD_REQUEST, CONFLICT, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK, UNAUTHORIZED } from "@/utils/status.utils";
import {
  DEV_ACCESS_SYNC_HEADER, DEV_ACCESS_SYNC_KEY, ListError, clearDevAccessCache, forwardToList, holdsList,
  isGatedHost, isWhitelisted, isWhitelistedLocally, readDevAccess, signDevAccessToken,
} from "@/middlewares/devAccess.middleware";
import { canManageTestApp } from "@/controllers/platformGovernance.controller";
import { platformGovernance } from "@/models/platformGovernance.model";
import { cleanUsagePing, clearUsage, recordUsage, usageDetail, weekMinutesByAddress } from "@/utils/devAccessUsage.utils";

const sameKey = (a: string, b: string) => {
  const [left, right] = [Buffer.from(a), Buffer.from(b)];
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
};

export const devAccessStatus = async (req: GlobalRequest, res: GlobalResponse) => {
  const enabled = isGatedHost(req);
  const address = enabled ? await readDevAccess(req) : null;
  res.status(OK).json({ enabled, access: address ? { address } : null });
};

/**
 * POST /dev-access/verify-session { remember }: the test app's one-signature sign-in. The wallet signs the
 * normal Nexura login (/user/sign-in), and that session proves the wallet here; a whitelisted one gets the pass.
 */
export const devAccessVerifySession = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const address = String((req.user as { address?: string } | undefined)?.address ?? "").toLowerCase();
    if (!isAddress(address)) {
      res.status(BAD_REQUEST).json({ error: "this Nexura account has no wallet" });
      return;
    }
    clearDevAccessCache(address);
    if (!(await isWhitelisted(address))) {
      res.status(FORBIDDEN).json({ error: "this wallet isn't on the test app whitelist" });
      return;
    }
    res.status(OK).json({ token: signDevAccessToken(address, req.body?.remember !== false), access: { address } });
  } catch (error) {
    if (error instanceof ListError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "sign-in failed" });
  }
};

// Drops floods from one pass; the list holder separately makes sure a minute is only counted once
const USAGE_MIN_GAP_MS = 5_000;
const lastUsagePing = new Map<string, number>();

/** POST /dev-access/usage { active, pages, actions }: the test app's once-a-minute usage ping. */
export const devAccessUsagePing = async (req: GlobalRequest, res: GlobalResponse) => {
  const address = await readDevAccess(req);
  if (!address) {
    res.status(UNAUTHORIZED).json({ error: "sign in to the test app first" });
    return;
  }
  const now = Date.now();
  if (now - (lastUsagePing.get(address) ?? 0) < USAGE_MIN_GAP_MS) {
    res.status(OK).json({ recorded: false });
    return;
  }
  lastUsagePing.set(address, now);
  try {
    const ping = cleanUsagePing(req.body);
    if (isGatedHost(req)) await forwardToList("usage", { address, ...ping, adminName: "test app" });
    else await recordUsage(address, ping);
    res.status(OK).json({ recorded: true });
  } catch (error) {
    if (!(error instanceof ListError)) logger.error(error);
    res.status(OK).json({ recorded: false });
  }
};

/** GET /dev-access/allowed?address=: the gated server asking the list holder, signed with DEV_ACCESS_SYNC_KEY. */
export const devAccessAllowed = async (req: GlobalRequest, res: GlobalResponse) => {
  if (!holdsList(req) || !sameKey(String(req.header(DEV_ACCESS_SYNC_HEADER) ?? ""), DEV_ACCESS_SYNC_KEY)) {
    res.status(FORBIDDEN).json({ error: "the test app server's DEV_ACCESS_SYNC_KEY doesn't match the main API's" });
    return;
  }
  try {
    res.status(OK).json({ allowed: await isWhitelistedLocally(String(req.query.address ?? "")) });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "could not check the wallet" });
  }
};

// Whitelist actions for dashboard admins. They only run on the server that holds
// the list; the gated server forwards them there with the admin's name attached.

// "seen" and "usage" are only sent by the gated server (sync key), as a whitelisted wallet uses the test app
type Action = "list" | "check" | "add" | "remove" | "update" | "seen" | "usage" | "usage-detail";
const ACTIONS: Action[] = ["list", "check", "add", "remove", "update", "seen", "usage", "usage-detail"];
const READ_ONLY: Action[] = ["list", "check", "usage-detail"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
const cleanName = (v: unknown) => String(v ?? "").trim().slice(0, 60);

type DashboardAdmin = { name: string; canInvite: boolean };

// Admins of the Nexura dashboard, by email. The ones who can add people to the whitelist are the Owner
// and anyone given that right when they were invited (admin.testAppInvite).
async function dashboardAdmins(): Promise<Map<string, DashboardAdmin>> {
  const members = new Map<string, DashboardAdmin>();
  const [rows, gov] = await Promise.all([
    admin.find({ verified: true }, { email: 1, username: 1, testAppInvite: 1 }).lean() as Promise<{ _id: unknown; email?: string; username?: string; testAppInvite?: boolean }[]>,
    platformGovernance.findOne({ key: "platform" }, { ownerId: 1 }).lean() as Promise<{ ownerId?: unknown } | null>,
  ]);
  const ownerId = gov?.ownerId ? String(gov.ownerId) : "";
  for (const a of rows) {
    if (!a.email) continue;
    members.set(String(a.email).toLowerCase(), {
      name: String(a.username ?? "") || String(a.email).split("@")[0]!,
      canInvite: String(a._id) === ownerId || !!a.testAppInvite,
    });
  }
  return members;
}

const toEntry = (r: any, members: Map<string, DashboardAdmin>, weekMinutes: Map<string, number>) => ({
  address: r.address,
  label: r.label ?? "",
  email: r.email ?? "",
  addedBy: r.addedBy ?? "",
  dashboardAdmin: !!r.email && members.has(r.email),
  canInvite: !!r.email && !!members.get(r.email)?.canInvite,
  addedAt: r.createdAt,
  lastSeenAt: r.lastSeenAt ?? null,
  usage: {
    activeMinutes: r.usage?.activeMinutes ?? 0,
    weekMinutes: weekMinutes.get(r.address) ?? 0,
    visits: r.usage?.visits ?? 0,
    pageViews: r.usage?.pageViews ?? 0,
    actions: r.usage?.actions ?? 0,
  },
});

async function runAction(action: Action, body: any, adminName: string) {
  if (action === "list") {
    const [rows, members, weekMinutes] = await Promise.all([devAccess.find().sort({ createdAt: -1 }).lean(), dashboardAdmins(), weekMinutesByAddress()]);
    return { entries: (rows as any[]).map(r => toEntry(r, members, weekMinutes)) };
  }

  if (action === "check") {
    const email = cleanEmail(body?.email);
    const members = await dashboardAdmins();
    const member = members.get(email);
    return { dashboardAdmin: !!member, memberName: member?.name ?? "", canInvite: !!member?.canInvite };
  }

  const address = String(body?.address ?? "").trim().toLowerCase();
  if (!isAddress(address)) throw new ListError("enter a valid wallet address", BAD_REQUEST);

  if (action === "add") {
    const label = cleanName(body?.label);
    const email = cleanEmail(body?.email);
    if (!label) throw new ListError("a name is required", BAD_REQUEST);
    if (!EMAIL_RE.test(email)) throw new ListError("enter a valid email", BAD_REQUEST);
    if (await devAccess.exists({ address })) throw new ListError("this wallet already has access", CONFLICT);
    await devAccess.create({ address, label, email, addedBy: adminName });
    clearDevAccessCache(address);
    return { added: 1 };
  }

  if (action === "seen") {
    await devAccess.updateOne({ address }, { $set: { lastSeenAt: new Date() } });
    return { seen: 1 };
  }

  if (action === "usage") {
    await recordUsage(address, cleanUsagePing(body));
    return { recorded: 1 };
  }

  if (action === "usage-detail") {
    if (!(await devAccess.exists({ address }))) throw new ListError("this wallet isn't on the whitelist", NOT_FOUND);
    return await usageDetail(address);
  }

  if (action === "remove") {
    const { deletedCount } = await devAccess.deleteOne({ address });
    if (!deletedCount) throw new ListError("this wallet isn't on the whitelist", NOT_FOUND);
    await clearUsage(address);
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
    await devAccess.updateOne({ address }, { $set: set });
    clearDevAccessCache(address);
    return { updated: 1 };
  }

  throw new ListError("unknown action", NOT_FOUND);
}

// Dashboard admins with the test app right, from either dashboard.
export const adminDevAccess = (action: Action) => async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (!(await canManageTestApp(String(req.id)))) {
      res.status(FORBIDDEN).json({ error: "you weren't given the right to add people to the test app" });
      return;
    }
    const body = action === "list" ? {} : (req.body ?? {});
    const adminName = req.adminName ?? "Admin";
    const result = holdsList(req) ? await runAction(action, body, adminName) : await forwardToList(action, { ...body, adminName });
    if (!READ_ONLY.includes(action)) clearDevAccessCache();
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
