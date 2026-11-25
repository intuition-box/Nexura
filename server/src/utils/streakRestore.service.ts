import mongoose from "mongoose";
import { formatDate } from "date-fns";
import logger from "@/config/logger";
import { user } from "@/models/user.model";
import { xpLog } from "@/models/xpLog.model";
import { usedTx } from "@/models/usedTx.model";
import { dailySignIn } from "@/models/dailySignIn.model";
import { streakRestore, streakRestoreAttempt } from "@/models/streakRestore.model";
import { evaluateGift, restoreProposalTitle, RESTORE_XP, type GiftEvaluation } from "@/utils/streakRestore.utils";
import { previousUtcDateKey, toUtcDateKey } from "@/utils/streak.utils";

const intSetting = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(String(raw ?? "").trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const zoneSetting = (raw: string | undefined) => {
  const zone = String(raw ?? "").trim() || "Africa/Lagos";
  try { new Intl.DateTimeFormat("en-GB", { timeZone: zone }); return zone; } catch { return "Africa/Lagos"; }
};
export const STREAK_TIMEZONE = zoneSetting(process.env.STREAK_TIMEZONE);
export const STREAK_RESTORE_COOLDOWN_DAYS = intSetting(process.env.STREAK_RESTORE_COOLDOWN_DAYS, 7, 1, 90);
export const STREAK_RESTORE_LOOKBACK_DAYS = intSetting(process.env.STREAK_RESTORE_LOOKBACK_DAYS, 21, 7, 90);

export class StreakRestoreError extends Error {
  constructor(public status: number, message: string, public final = false) { super(message); }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function cleanAddress(raw: unknown): string {
  if (typeof raw !== "string") throw new StreakRestoreError(400, "Enter a full wallet address (0x followed by 40 characters).");
  const address = raw.trim();
  if (!ADDRESS.test(address)) throw new StreakRestoreError(400, "Enter a full wallet address (0x followed by 40 characters).");
  return address.toLowerCase();
}

type UserRow = { _id: mongoose.Types.ObjectId; address: string; username?: string; streak?: number; streakToRestore?: number; lastSignInDate?: string | null; longestStreak?: number };

async function loadUser(address: string): Promise<UserRow> {
  const u = await user.findOne({ address }).select("_id address username streak streakToRestore lastSignInDate longestStreak").lean() as UserRow | null;
  if (!u) throw new StreakRestoreError(404, "No Nexura user has this wallet.");
  return u;
}

async function loadHistory(u: UserRow) {
  const [logs, restores, legacyPaid, attempts] = await Promise.all([
    xpLog.find({ address: u.address, type: "daily-xp" }).select("status timestamp").sort({ timestamp: -1 }).limit(3000).lean() as Promise<{ status: string; timestamp: Date }[]>,
    streakRestore.find({ user: u._id }).sort({ createdAt: -1 }).limit(200).lean() as Promise<any[]>,
    usedTx.find({ user: u._id, purpose: "restore-streak" }).select("createdAt").lean() as Promise<{ createdAt: Date }[]>,
    streakRestoreAttempt.find({ address: u.address }).sort({ createdAt: -1 }).limit(50).lean() as Promise<any[]>,
  ]);

  const checkInDays: string[] = [];
  const failedDays: string[] = [];
  const checkInTimes: Record<string, string> = {};
  for (const l of logs) {
    if (!(l.timestamp instanceof Date) || isNaN(l.timestamp.getTime())) continue;
    const day = toUtcDateKey(l.timestamp);
    if (l.status === "success") {
      checkInDays.push(day);
      if (!checkInTimes[day] || checkInTimes[day] < l.timestamp.toISOString()) checkInTimes[day] = l.timestamp.toISOString();
    } else failedDays.push(day);
  }
  for (const a of attempts) if (!a.ok && a.createdAt) failedDays.push(toUtcDateKey(new Date(a.createdAt)));

  const bridgedDays: string[] = [];
  const restoreDays: string[] = [];
  const giftedMissedDays: string[] = [];
  let lastRestoreAt: Date | null = null;
  const later = (d: Date) => { if (!lastRestoreAt || d > lastRestoreAt) lastRestoreAt = d; };
  for (const r of restores) {
    bridgedDays.push(...(r.bridgedDays ?? []), r.missedDay);
    if (r.countedDay) restoreDays.push(r.countedDay);
    giftedMissedDays.push(r.missedDay);
    if (r.createdAt) later(new Date(r.createdAt));
  }
  for (const p of legacyPaid) {
    if (!p.createdAt) continue;
    const at = new Date(p.createdAt);
    restoreDays.push(toUtcDateKey(at));
    bridgedDays.push(previousUtcDateKey(at));
    later(at);
  }
  return { checkInDays, failedDays, checkInTimes, bridgedDays, restoreDays, giftedMissedDays, lastRestoreAt: lastRestoreAt as Date | null, restores, attempts };
}

export type StreakEvidence = GiftEvaluation & {
  user: { id: string; address: string; username: string; streak: number; longestStreak: number; lastSignInDate: string | null };
  timezone: string;
  lookbackDays: number;
  cooldownDays: number;
  proposalTitle: string | null;
  restores: { at: string; source: string; fromStreak: number; toStreak: number; xp: number; missedDay: string; proposedBy: string }[];
  attempts: { at: string; ok: boolean; reason: string; txHash: string }[];
};

export async function streakEvidence(rawAddress: unknown, now = new Date()): Promise<StreakEvidence & { _user: UserRow }> {
  const address = cleanAddress(rawAddress);
  const u = await loadUser(address);
  const h = await loadHistory(u);
  const evaluation = evaluateGift({
    now,
    checkInDays: h.checkInDays,
    checkInTimes: h.checkInTimes,
    failedDays: h.failedDays,
    bridgedDays: h.bridgedDays,
    restoreDays: h.restoreDays,
    user: { streak: Number(u.streak ?? 0), streakToRestore: Number(u.streakToRestore ?? 0), lastSignInDate: u.lastSignInDate ?? null, longestStreak: Number(u.longestStreak ?? 0) },
    lastRestoreAt: h.lastRestoreAt,
    giftedMissedDays: h.giftedMissedDays,
    cooldownDays: STREAK_RESTORE_COOLDOWN_DAYS,
    lookbackDays: STREAK_RESTORE_LOOKBACK_DAYS,
  });
  return {
    ...evaluation,
    _user: u,
    user: { id: String(u._id), address: u.address, username: u.username ?? "", streak: Number(u.streak ?? 0), longestStreak: Number(u.longestStreak ?? 0), lastSignInDate: u.lastSignInDate ?? null },
    timezone: STREAK_TIMEZONE,
    lookbackDays: STREAK_RESTORE_LOOKBACK_DAYS,
    cooldownDays: STREAK_RESTORE_COOLDOWN_DAYS,
    proposalTitle: evaluation.eligible ? restoreProposalTitle(u.address, evaluation.toStreak) : null,
    restores: h.restores.slice(0, 10).map(r => ({
      at: new Date(r.createdAt).toISOString(), source: r.source, fromStreak: r.fromStreak, toStreak: r.toStreak, xp: r.xp ?? 0, missedDay: r.missedDay, proposedBy: r.proposedBy?.name ?? "",
    })),
    attempts: h.attempts.slice(0, 10).map(a => ({ at: new Date(a.createdAt).toISOString(), ok: !!a.ok, reason: String(a.reason ?? "").slice(0, 200), txHash: String(a.txHash ?? "") })),
  };
}

export type RestoreStreakAction = {
  kind: "restoreStreak"; userId: string; address: string; username: string;
  scenario: "pending" | "resumed"; missedDay: string; fromStreak: number; toStreak: number; xp: number;
};

export async function restoreStreakAction(rawAddress: unknown, title: unknown): Promise<RestoreStreakAction> {
  const ev = await streakEvidence(rawAddress);
  if (!ev.eligible) throw new StreakRestoreError(400, ev.reasons.join(" ") || "This streak can't be restored.");
  if (title !== ev.proposalTitle) throw new StreakRestoreError(400, "The proposal title doesn't match what the server would restore. Check the wallet again.");
  return {
    kind: "restoreStreak", userId: ev.user.id, address: ev.user.address, username: ev.user.username,
    scenario: ev.scenario!, missedDay: ev.missedDay!, fromStreak: ev.fromStreak, toStreak: ev.toStreak, xp: ev.xp,
  };
}

export async function applyRestoreStreak(action: RestoreStreakAction, meta: { proposalRef?: string; proposedBy?: { id: string; name: string } } = {}, now = new Date()) {
  const ev = await streakEvidence(action?.address, now);
  if (String(ev.user.id) !== String(action.userId)) throw new StreakRestoreError(409, "This wallet belongs to a different user now.", true);
  if (!ev.eligible) throw new StreakRestoreError(409, `No longer eligible: ${ev.reasons.join(" ")}`, true);
  if (ev.missedDay !== action.missedDay) throw new StreakRestoreError(409, "Their check-in history changed since this was proposed. Check the wallet again and make a new proposal.", true);

  const u = ev._user;
  const today = toUtcDateKey(now);
  let log;
  try {
    log = await streakRestore.create({
      user: u._id, address: u.address, username: u.username ?? "", source: "gift", scenario: ev.scenario,
      bridgedDays: [ev.missedDay], missedDay: ev.missedDay, countedDay: ev.scenario === "pending" ? today : null,
      fromStreak: ev.fromStreak, toStreak: ev.toStreak, xp: ev.xp,
      proposalRef: meta.proposalRef ?? null, proposedBy: meta.proposedBy ?? { id: null, name: "" },
    });
  } catch (err: any) {
    if (err?.code === 11000) throw new StreakRestoreError(409, "This break was already restored.", true);
    throw err;
  }

  const filter = { _id: u._id, streak: Number(u.streak ?? 0), lastSignInDate: u.lastSignInDate ?? null };
  const update = ev.scenario === "pending"
    ? { $set: { streak: ev.toStreak, lastSignInDate: today, streakToRestore: 0 }, $inc: { xp: RESTORE_XP, totalCheckIns: 1 }, $max: { longestStreak: ev.toStreak } }
    : { $set: { streak: ev.toStreak }, $max: { longestStreak: ev.toStreak } };
  const done = await user.updateOne(filter, update);
  if (!done.modifiedCount) {
    await streakRestore.deleteOne({ _id: log._id });
    throw new StreakRestoreError(409, "Their streak changed while this was running. Execute it again.");
  }

  if (ev.scenario === "pending") {
    const month = formatDate(now, "MMM, y");
    await dailySignIn.updateOne({ user: u._id, month }, { $inc: { xpClaimedThisMonth: RESTORE_XP }, $setOnInsert: { date: today } }, { upsert: true })
      .catch(err => logger.error("streak gift: monthly sign-in record", err));
    await xpLog.create({ address: u.address, username: u.username, amount: RESTORE_XP, status: "success", type: "daily-xp", timestamp: now })
      .catch(err => logger.error("streak gift: xp log", err));
  }
  return log;
}

export async function recordPaidRestore(before: { _id: unknown; address: string; username?: string; streakToRestore?: number; lastSignInDate?: string | null }, txHash: string, now = new Date()) {
  try {
    const today = toUtcDateKey(now);
    const missedDay = previousUtcDateKey(now);
    const bridgedDays: string[] = [];
    const last = typeof before.lastSignInDate === "string" ? Date.parse(`${before.lastSignInDate}T00:00:00Z`) : NaN;
    if (!isNaN(last)) for (let t = last + DAY_MS; t < Date.parse(`${today}T00:00:00Z`) && bridgedDays.length < 60; t += DAY_MS) bridgedDays.push(toUtcDateKey(new Date(t)));
    const from = Number(before.streakToRestore ?? 0);
    await streakRestore.create({
      user: before._id, address: String(before.address).toLowerCase(), username: before.username ?? "", source: "paid", scenario: "pending",
      bridgedDays, missedDay, countedDay: today, fromStreak: from, toStreak: from + 1, xp: RESTORE_XP, txHash,
    });
    await xpLog.create({ address: before.address, username: before.username, amount: RESTORE_XP, status: "success", type: "daily-xp", timestamp: now });
  } catch (err: any) {
    if (err?.code !== 11000) logger.error("couldn't record a paid streak restore", err);
  }
}

export function recordRestoreAttempt(entry: { user?: unknown; address?: string; txHash?: string; status: number; body?: unknown }) {
  const body = entry.body && typeof entry.body === "object" ? entry.body as Record<string, unknown> : {};
  const ok = entry.status >= 200 && entry.status < 300;
  const reason = ok ? "restored" : String(body.error ?? body.message ?? `failed (${entry.status})`);
  streakRestoreAttempt.create({
    user: entry.user, address: String(entry.address ?? "").toLowerCase(), txHash: String(entry.txHash ?? "").slice(0, 80),
    ok, status: entry.status, reason: reason.slice(0, 300),
  }).catch(err => logger.error("couldn't record a streak restore attempt", err));
}

export async function recentRestores(limit = 50) {
  const rows = await streakRestore.find().sort({ createdAt: -1 }).limit(Math.min(Math.max(1, limit), 200)).lean() as any[];
  return rows.map(r => ({
    at: new Date(r.createdAt).toISOString(), address: r.address, username: r.username ?? "", source: r.source,
    fromStreak: r.fromStreak, toStreak: r.toStreak, xp: r.xp ?? 0, missedDay: r.missedDay, proposedBy: r.proposedBy?.name ?? "", proposalRef: r.proposalRef ?? null,
  }));
}
