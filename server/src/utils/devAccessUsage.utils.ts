import { devAccess } from "@/models/devAccess.model";
import { devAccessUsage } from "@/models/devAccessUsage.model";

// The test app pings once a minute while a tester is actively using it (see client/src/lib/testAppUsage.ts)
const VISIT_GAP_MS = 30 * 60 * 1000; // back after 30 minutes away counts as a new visit
const MINUTE_GAP_MS = 45 * 1000;
const CHART_DAYS = 14;
const TOP = 8;
const MAX_KEYS = 20;
const MAX_COUNT = 50;
const PAGE_RE = /^\/[a-z0-9\-/:]{0,79}$/i;
const ACTION_RE = /^[a-z0-9-]{1,30}(\/[a-z0-9-]{1,40})?$/;

export type UsagePing = { active: boolean; pages: Record<string, number>; actions: Record<string, number> };

const counts = (raw: unknown, re: RegExp) => {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw).slice(0, MAX_KEYS)) {
    const n = Math.floor(Number(value));
    if (re.test(key) && n > 0) out[key] = Math.min(n, MAX_COUNT);
  }
  return out;
};

export const cleanUsagePing = (body: any): UsagePing => ({
  active: body?.active === true,
  pages: counts(body?.pages, PAGE_RE),
  actions: counts(body?.actions, ACTION_RE),
});

const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function recordUsage(address: string, ping: UsagePing) {
  const [pageViews, actions] = [total(ping.pages), total(ping.actions)];
  if (!ping.active && !pageViews && !actions) return;
  const now = new Date();

  const before = await devAccess.findOneAndUpdate({ address }, { $set: { lastActiveAt: now, lastSeenAt: now } }, { projection: { lastActiveAt: 1 } }).lean() as { lastActiveAt?: Date | null } | null;
  if (!before) return;
  const visits = !before.lastActiveAt || now.getTime() - new Date(before.lastActiveAt).getTime() > VISIT_GAP_MS ? 1 : 0;

  let activeMinutes = 0;
  if (ping.active) {
    const { modifiedCount } = await devAccess.updateOne(
      { address, $or: [{ lastMinuteAt: null }, { lastMinuteAt: { $lte: new Date(now.getTime() - MINUTE_GAP_MS) } }] },
      { $set: { lastMinuteAt: now } },
    );
    activeMinutes = modifiedCount ? 1 : 0;
  }

  if (!activeMinutes && !visits && !pageViews && !actions) return;
  const inc: Record<string, number> = { activeMinutes, visits };
  for (const [page, n] of Object.entries(ping.pages)) inc[`pages.${page}`] = n;
  for (const [action, n] of Object.entries(ping.actions)) inc[`actions.${action}`] = n;
  await Promise.all([
    devAccess.updateOne({ address }, { $inc: { "usage.activeMinutes": activeMinutes, "usage.visits": visits, "usage.pageViews": pageViews, "usage.actions": actions } }),
    devAccessUsage.updateOne({ address, day: dayKey(now) }, { $inc: inc }, { upsert: true }),
  ]);
}

/** Active minutes per tester over the last 7 days, for the list. */
export async function weekMinutesByAddress(): Promise<Map<string, number>> {
  const since = dayKey(new Date(Date.now() - 6 * 86_400_000));
  const rows = await devAccessUsage.aggregate([
    { $match: { day: { $gte: since } } },
    { $group: { _id: "$address", minutes: { $sum: "$activeMinutes" } } },
  ]) as { _id: string; minutes: number }[];
  return new Map(rows.map(r => [r._id, r.minutes]));
}

const top = (merged: Map<string, number>, name: "path" | "action") =>
  [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([key, count]) => ({ [name]: key, count }));

/** One tester's last 14 days, day by day, and the pages and actions they used most. */
export async function usageDetail(address: string) {
  const docs = await devAccessUsage.find({ address }).lean() as { day: string; activeMinutes?: number; visits?: number; pages?: Record<string, number>; actions?: Record<string, number> }[];
  const byDay = new Map(docs.map(d => [d.day, d]));
  const pages = new Map<string, number>();
  const actions = new Map<string, number>();
  for (const d of docs) {
    for (const [k, n] of Object.entries(d.pages ?? {})) pages.set(k, (pages.get(k) ?? 0) + n);
    for (const [k, n] of Object.entries(d.actions ?? {})) actions.set(k, (actions.get(k) ?? 0) + n);
  }
  const days = Array.from({ length: CHART_DAYS }, (_, i) => {
    const day = dayKey(new Date(Date.now() - (CHART_DAYS - 1 - i) * 86_400_000));
    const d = byDay.get(day);
    return {
      day,
      activeMinutes: d?.activeMinutes ?? 0,
      visits: d?.visits ?? 0,
      pageViews: total(d?.pages ?? {}),
      actions: total(d?.actions ?? {}),
    };
  });
  return { days, topPages: top(pages, "path"), topActions: top(actions, "action") };
}

export const clearUsage = (address: string) => devAccessUsage.deleteMany({ address });
