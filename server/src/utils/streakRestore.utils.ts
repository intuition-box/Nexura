import { previousUtcDateKey, toUtcDateKey } from "./streak.utils";

export const RESTORE_XP = 50;

export type DayStatus = "checked" | "restored" | "missed" | "failed" | "today";
export type CalendarDay = { day: string; status: DayStatus; at?: string };
export type StreakRun = { start: string; end: string; length: number };

export type GiftScenario = "pending" | "resumed";

export type GiftEvaluation = {
  eligible: boolean;
  reasons: string[];
  scenario: GiftScenario | null;
  missedDay: string | null;
  lostStreak: number;
  fromStreak: number;
  toStreak: number;
  xp: number;
  calendar: CalendarDay[];
  runs: StreakRun[];
  lastCheckInDay: string | null;
  daysSinceLastCheckIn: number | null;
  cooldownUntil: string | null;
};

export type GiftInput = {
  now: Date;
  checkInDays: string[];
  checkInTimes?: Record<string, string>;
  failedDays: string[];
  bridgedDays: string[];
  restoreDays: string[];
  user: { streak: number; streakToRestore: number; lastSignInDate?: string | null; longestStreak?: number };
  lastRestoreAt: Date | null;
  giftedMissedDays: string[];
  cooldownDays: number;
  lookbackDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (d: Date) => toUtcDateKey(d);
const addDays = (key: string, n: number) => toUtcDateKey(new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS));
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
const isDayKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(`${v}T00:00:00Z`));

export function runsOf(active: Set<string>): StreakRun[] {
  const days = [...active].filter(isDayKey).sort();
  const runs: StreakRun[] = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && addDays(last.end, 1) === d) { last.end = d; last.length++; }
    else runs.push({ start: d, end: d, length: 1 });
  }
  return runs.reverse();
}

function runEndingOn(active: Set<string>, end: string): number {
  let n = 0;
  for (let d = end; active.has(d); d = addDays(d, -1)) n++;
  return n;
}

export function evaluateGift(input: GiftInput): GiftEvaluation {
  const today = dayKey(input.now);
  const yesterday = previousUtcDateKey(input.now);
  const lookback = Math.max(1, Math.floor(input.lookbackDays));
  const windowStart = addDays(today, -(lookback - 1));
  const u = input.user;
  const userStreak = Math.max(0, Math.floor(Number(u.streak) || 0));
  const streakToRestore = Math.max(0, Math.floor(Number(u.streakToRestore) || 0));
  const lastSignIn = isDayKey(u.lastSignInDate) ? u.lastSignInDate : null;

  const checked = new Set(input.checkInDays.filter(isDayKey));
  const restoreDays = new Set(input.restoreDays.filter(isDayKey));
  const bridged = new Set(input.bridgedDays.filter(isDayKey));
  const active = new Set<string>([...checked, ...restoreDays, ...bridged]);
  if (lastSignIn) active.add(lastSignIn);
  const failed = new Set(input.failedDays.filter(isDayKey));

  const calendar: CalendarDay[] = [];
  for (let i = lookback - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const status: DayStatus = checked.has(day) || (day === lastSignIn && !restoreDays.has(day)) ? "checked"
      : restoreDays.has(day) || bridged.has(day) ? "restored"
      : day === today ? "today"
      : failed.has(day) ? "failed" : "missed";
    calendar.push({ day, status, ...(input.checkInTimes?.[day] ? { at: input.checkInTimes[day] } : {}) });
  }

  const runs = runsOf(active).filter(r => r.end >= windowStart).slice(0, 6);
  const lastCheckInDay = [...active].filter(d => d <= today).sort().pop() ?? null;
  const daysSinceLastCheckIn = lastCheckInDay ? daysBetween(lastCheckInDay, today) : null;

  const base = {
    calendar, runs, lastCheckInDay, daysSinceLastCheckIn, cooldownUntil: null as string | null,
    scenario: null as GiftScenario | null, missedDay: null as string | null, lostStreak: 0,
    fromStreak: userStreak, toStreak: userStreak, xp: 0,
  };
  const no = (...reasons: string[]) => ({ ...base, eligible: false, reasons });

  if (input.lastRestoreAt && !isNaN(input.lastRestoreAt.getTime())) {
    const until = new Date(input.lastRestoreAt.getTime() + Math.max(0, input.cooldownDays) * DAY_MS);
    if (until.getTime() > input.now.getTime()) {
      base.cooldownUntil = until.toISOString();
      return no(`Their streak was already restored on ${input.lastRestoreAt.toISOString()}. Only one restore per ${input.cooldownDays} days.`);
    }
  }

  if (!lastCheckInDay || lastCheckInDay < windowStart) {
    return no(`No check-ins in the last ${lookback} days, so there's no streak to restore.`);
  }

  let scenario: GiftScenario;
  let missedDay: string;
  let lostStreak: number;
  let toStreak: number;
  let xp: number;

  if (!active.has(today) && !active.has(yesterday)) {
    const missed = daysSinceLastCheckIn! - 1;
    if (missed > 1) return no(`They missed ${missed} days in a row (last check-in ${lastCheckInDay}). A restore only covers one missed day, so their streak was lost before any restore could help.`);
    if (lastSignIn !== lastCheckInDay) return no("Their account and their check-in history disagree about the last check-in. Ask the Nexura team to look at this one.");
    scenario = "pending";
    missedDay = yesterday;
    lostStreak = streakToRestore > 0 ? streakToRestore : userStreak;
    if (lostStreak <= 0) return no("They have no streak to restore.");
    toStreak = lostStreak + 1;
    xp = RESTORE_XP;
  } else {
    const end = active.has(today) ? today : yesterday;
    const currentRun = runEndingOn(active, end);
    const start = addDays(end, -(currentRun - 1));
    const gap = addDays(start, -1);
    if (gap < windowStart) return no(`Their streak isn't broken in the last ${lookback} days (current streak ${userStreak}).`);
    if (active.has(addDays(gap, -1)) === false) {
      const prev = [...active].filter(d => d < gap).sort().pop();
      const missed = prev ? daysBetween(prev, start) - 1 : null;
      return no(missed ? `They missed ${missed} days in a row before checking in again on ${start}. A restore only covers one missed day.` : "There's no earlier streak to restore.");
    }
    if (userStreak > currentRun) {
      return no(`Their streak is already ${userStreak}, more than their ${currentRun} check-in day${currentRun === 1 ? "" : "s"} since the break, so it looks restored already.`);
    }
    scenario = "resumed";
    missedDay = gap;
    lostStreak = runEndingOn(active, addDays(gap, -1));
    toStreak = lostStreak + Math.max(userStreak, 1);
    xp = 0;
    if (lostStreak <= 0) return no("There's no earlier streak to restore.");
  }

  if (input.giftedMissedDays.includes(missedDay)) {
    return no(`The streak lost on ${missedDay} was already restored once. The same break can't be restored twice.`);
  }

  return {
    ...base, eligible: true, reasons: [], scenario, missedDay, lostStreak, fromStreak: userStreak, toStreak, xp,
  };
}

export const restoreProposalTitle = (address: string, toStreak: number) =>
  `Restore streak for ${address.slice(0, 6)}…${address.slice(-4)} to ${toStreak} days`;
