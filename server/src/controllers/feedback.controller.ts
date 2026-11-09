import { timingSafeEqual } from "crypto";
import mongoose from "mongoose";
import logger from "@/config/logger";
import { feedback } from "@/models/feedback.model";
import { hub, userHub } from "@/models/hub.model";
import { user } from "@/models/user.model";
import { BAD_REQUEST, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND, OK } from "@/utils/status.utils";
import { uploadImg } from "@/utils/img.utils";
import {
  DEV_ACCESS_SYNC_HEADER, DEV_ACCESS_SYNC_KEY, ListError, forwardToMain, holdsList, isGatedHost,
} from "@/middlewares/devAccess.middleware";

/*
 * Feature requests, bug reports and support tickets. They are kept on the main API so the Nexura team
 * sees every report in one dashboard: the test app server (staging) forwards each action there,
 * signed with DEV_ACCESS_SYNC_KEY, just like the test app whitelist.
 */

type Reporter = { type: "user" | "studio"; accountId: string; name: string; wallet: string; hubId?: string; hubName?: string };
type Body = Record<string, any>;

const KINDS = ["feature", "bug", "help"] as const;
const STATUSES = ["open", "replied", "closed"] as const;
const MAX_FILES = 3;
const HOURLY_LIMIT = 10;
const HOUR_MS = 60 * 60 * 1000;

const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
// Minimums so a report says something; no limit people would notice, only a ceiling against abuse
const TITLE_MIN = 10;
const DETAILS_MIN = 30;
const REPLY_MIN = 2;
const TITLE_CEILING = 500;
const TEXT_CEILING = 20_000;
function written(v: unknown, min: number, ceiling: number, what: string): string {
  const s = String(v ?? "").trim();
  if (s.length < min) fail(`${what} needs at least ${min} characters`);
  if (s.length > ceiling) fail(`${what} is too long (over ${ceiling.toLocaleString("en-US")} characters)`);
  return s;
}
const isId = (v: unknown): v is string => typeof v === "string" && mongoose.Types.ObjectId.isValid(v);
const fail = (message: string, status: number = BAD_REQUEST): never => { throw new ListError(message, status); };

function cleanReporter(raw: any): Reporter {
  const type = raw?.type === "studio" ? "studio" : raw?.type === "user" ? "user" : fail("who sent this report is missing");
  const accountId = text(raw?.accountId, 64) || fail("who sent this report is missing");
  return {
    type, accountId,
    name: text(raw?.name, 80),
    wallet: text(raw?.wallet, 64).toLowerCase(),
    hubId: text(raw?.hubId, 64),
    hubName: text(raw?.hubName, 120),
  };
}

// One person's reports: by wallet (the same on the main app and the test app), else by account
const mine = (r: Reporter) => r.wallet
  ? { "reporter.type": r.type, "reporter.wallet": r.wallet }
  : { "reporter.type": r.type, "reporter.accountId": r.accountId };

// What the reporter sees: the team's replies are signed "Nexura team"
const forReporter = (f: any) => ({
  _id: String(f._id), kind: f.kind, status: f.status, title: f.title, details: f.details,
  attachments: f.attachments ?? [], createdAt: f.createdAt, unread: !!f.reporterUnread,
  replies: (f.replies ?? []).map((r: any) => ({ from: r.from, name: r.from === "team" ? "Nexura team" : r.name, message: r.message, at: r.at })),
});

const ACTIONS: Record<string, (b: Body) => Promise<unknown>> = {
  async submit(b) {
    const reporter = cleanReporter(b.reporter);
    const kind = KINDS.includes(b.kind) ? b.kind : fail("choose Feature, Bug report or Get help");
    const title = written(b.title, TITLE_MIN, TITLE_CEILING, kind === "help" ? "The subject" : "The title");
    const details = written(b.details, DETAILS_MIN, TEXT_CEILING, "The details");
    const recent = await feedback.countDocuments({ ...mine(reporter), createdAt: { $gt: new Date(Date.now() - HOUR_MS) } });
    if (recent >= HOURLY_LIMIT) fail("You've sent a lot of reports in the last hour. Try again later.", 429);
    const attachments = (Array.isArray(b.attachments) ? b.attachments : [])
      .filter((u: unknown) => typeof u === "string" && /^https:\/\/\S+$/.test(u)).slice(0, MAX_FILES);
    const doc = await feedback.create({
      kind, title, details, attachments, reporter,
      source: b.source === "studio" ? "studio" : "app",
      testApp: b.testApp === true,
      page: text(b.page, 300),
      userAgent: text(b.userAgent, 300),
    });
    return { report: forReporter(doc.toObject()) };
  },

  async mine(b) {
    const reporter = cleanReporter(b.reporter);
    const rows = await feedback.find(mine(reporter)).sort({ updatedAt: -1 }).limit(50).lean();
    return { reports: rows.map(forReporter), unread: rows.filter(r => r.reporterUnread).length };
  },

  async reply(b) {
    const reporter = cleanReporter(b.reporter);
    if (!isId(b.id)) fail("this report wasn't found", NOT_FOUND);
    const message = written(b.message, REPLY_MIN, TEXT_CEILING, "Your reply");
    const doc = await feedback.findOneAndUpdate(
      { _id: b.id, ...mine(reporter) },
      { $push: { replies: { from: "reporter", name: reporter.name, message } }, $set: { status: "open", teamUnread: true, reporterUnread: false } },
      { new: true },
    ).lean();
    if (!doc) fail("this report wasn't found", NOT_FOUND);
    return { report: forReporter(doc) };
  },

  async seen(b) {
    const reporter = cleanReporter(b.reporter);
    await feedback.updateMany({ ...mine(reporter), reporterUnread: true }, { $set: { reporterUnread: false } });
    return { ok: true };
  },

  async "admin-list"(b) {
    const filter: Record<string, unknown> = {};
    if (KINDS.includes(b.kind)) filter.kind = b.kind;
    if (STATUSES.includes(b.status)) filter.status = b.status;
    const [reports, byStatus, byKind, unread] = await Promise.all([
      b.countsOnly ? [] : feedback.find(filter).sort({ updatedAt: -1 }).limit(300).lean(),
      feedback.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      feedback.aggregate([{ $match: { status: { $ne: "closed" } } }, { $group: { _id: "$kind", n: { $sum: 1 } } }]),
      feedback.countDocuments({ teamUnread: true }),
    ]);
    const count = (rows: any[]) => Object.fromEntries(rows.map(r => [r._id, r.n]));
    return { reports, counts: { status: count(byStatus), openByKind: count(byKind), unread } };
  },

  async "admin-reply"(b) {
    if (!isId(b.id)) fail("this report wasn't found", NOT_FOUND);
    const message = written(b.message, REPLY_MIN, TEXT_CEILING, "Your reply");
    const doc = await feedback.findByIdAndUpdate(
      b.id,
      { $push: { replies: { from: "team", name: text(b.adminName, 80) || "Admin", message } }, $set: { status: "replied", reporterUnread: true, teamUnread: false } },
      { new: true },
    ).lean();
    if (!doc) fail("this report wasn't found", NOT_FOUND);
    return { report: doc };
  },

  async "admin-status"(b) {
    if (!isId(b.id)) fail("this report wasn't found", NOT_FOUND);
    if (!STATUSES.includes(b.status)) fail("choose a valid status");
    const doc = await feedback.findByIdAndUpdate(b.id, { $set: { status: b.status, teamUnread: false } }, { new: true }).lean();
    if (!doc) fail("this report wasn't found", NOT_FOUND);
    return { report: doc };
  },

  async "admin-seen"(b) {
    if (!isId(b.id)) fail("this report wasn't found", NOT_FOUND);
    await feedback.updateOne({ _id: b.id }, { $set: { teamUnread: false } });
    return { ok: true };
  },
};

/** Runs here on the main API; the test app server sends it there. */
const run = (req: GlobalRequest, action: string, body: Body) =>
  isGatedHost(req) ? forwardToMain(`/api/feedback/sync/${action}`, body) : ACTIONS[action]!(body);

const send = async (res: GlobalResponse, work: () => Promise<unknown>, fallback: string) => {
  try {
    res.status(OK).json(await work());
  } catch (error) {
    if (error instanceof ListError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: fallback });
  }
};

// ─── Who is reporting ───────────────────────────────────────────────────────
async function reporterOf(req: GlobalRequest, source: "app" | "studio"): Promise<Reporter> {
  if (source === "app") {
    const u = req.user ?? {};
    return { type: "user", accountId: String(req.id), name: String(u.username ?? ""), wallet: String(u.address ?? "").toLowerCase() };
  }
  const a = req.admin ?? {};
  let wallet = String(a.linkedWallet ?? "");
  if (!wallet && a.userId) wallet = String((await user.findById(a.userId).select("address").lean() as any)?.address ?? "");
  let hubName = "";
  if (a.hub) {
    const h = (await hub.findById(a.hub).select("name").lean() ?? await userHub.findById(a.hub).select("name").lean()) as any;
    hubName = String(h?.name ?? "");
  }
  return { type: "studio", accountId: String(a._id ?? req.id), name: String(a.name ?? ""), wallet: wallet.toLowerCase(), hubId: a.hub ? String(a.hub) : "", hubName };
}

// ─── App and Studio (signed-in people) ──────────────────────────────────────
export const submitFeedback = (source: "app" | "studio") => async (req: GlobalRequest, res: GlobalResponse) =>
  send(res, async () => {
    const files = ((req.files as Express.Multer.File[] | undefined) ?? []).slice(0, MAX_FILES);
    if (files.some(f => !f.mimetype?.startsWith("image/"))) fail("attachments must be images");
    const attachments = await Promise.all(files.map(f =>
      uploadImg({ file: f.buffer, filename: (f.originalname || "screenshot").replace(/[^\w.-]/g, "_").slice(-60), folder: "feedback" })));
    return run(req, "submit", {
      reporter: await reporterOf(req, source),
      kind: req.body?.kind, title: req.body?.title, details: req.body?.details, page: req.body?.page,
      userAgent: req.header("user-agent") ?? "", source, testApp: isGatedHost(req), attachments,
    });
  }, "couldn't send your report");

export const myFeedback = (source: "app" | "studio") => async (req: GlobalRequest, res: GlobalResponse) =>
  send(res, async () => run(req, "mine", { reporter: await reporterOf(req, source) }), "couldn't load your reports");

export const replyToMyFeedback = (source: "app" | "studio") => async (req: GlobalRequest, res: GlobalResponse) =>
  send(res, async () => run(req, "reply", { reporter: await reporterOf(req, source), id: req.body?.id, message: req.body?.message }), "couldn't send your reply");

export const markMyFeedbackSeen = (source: "app" | "studio") => async (req: GlobalRequest, res: GlobalResponse) =>
  send(res, async () => run(req, "seen", { reporter: await reporterOf(req, source) }), "couldn't update your reports");

// ─── Nexura team dashboard (/api/admin) ─────────────────────────────────────
export const adminListFeedback = (req: GlobalRequest, res: GlobalResponse) =>
  send(res, () => run(req, "admin-list", { kind: req.query.kind, status: req.query.status, countsOnly: req.query.countsOnly === "1" }), "couldn't load reports");

export const adminReplyFeedback = (req: GlobalRequest, res: GlobalResponse) =>
  send(res, () => run(req, "admin-reply", { id: req.body?.id, message: req.body?.message, adminName: req.adminName }), "couldn't send the reply");

export const adminSetFeedbackStatus = (req: GlobalRequest, res: GlobalResponse) =>
  send(res, () => run(req, "admin-status", { id: req.body?.id, status: req.body?.status }), "couldn't change the status");

export const adminMarkFeedbackSeen = (req: GlobalRequest, res: GlobalResponse) =>
  send(res, () => run(req, "admin-seen", { id: req.body?.id }), "couldn't update the report");

// ─── From the test app server ───────────────────────────────────────────────
const sameKey = (a: string, b: string) => {
  const [left, right] = [Buffer.from(a), Buffer.from(b)];
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
};

/** POST /feedback/sync/:action: the test app server running a feedback action here. */
export const feedbackSync = (req: GlobalRequest, res: GlobalResponse) => {
  if (!holdsList(req) || !sameKey(String(req.header(DEV_ACCESS_SYNC_HEADER) ?? ""), DEV_ACCESS_SYNC_KEY)) {
    res.status(FORBIDDEN).json({ error: "the test app server's DEV_ACCESS_SYNC_KEY doesn't match the main API's" });
    return;
  }
  const action = String(req.params.action);
  if (!Object.hasOwn(ACTIONS, action)) {
    res.status(BAD_REQUEST).json({ error: "bad sync request" });
    return;
  }
  return send(res, () => ACTIONS[action]!(req.body ?? {}), "couldn't handle the report");
};
