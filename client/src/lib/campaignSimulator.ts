export type ScoreStats = { totalUsers: number; buckets: Array<{ fromPct: number; toPct: number; users: number }> };

export const SLIDER_STEPS = 1000;
export const MIN_BUDGET_USD = 100;
export const MAX_BUDGET_USD = 1_000_000;
export const MIN_RECIPIENTS = 10;
export const MAX_RECIPIENTS = 100_000;

/** Users whose Nexura score is at or above `req`, prorating the bucket the requirement falls inside. */
export function eligibleAt(stats: ScoreStats | null, req: number): number {
  if (!stats?.buckets.length) return 0;
  return Math.round(stats.buckets.reduce((n, b) => {
    if (!(b.users > 0)) return n;
    if (b.fromPct >= req) return n + b.users;
    if (b.toPct > req && b.toPct > b.fromPct) return n + b.users * (b.toPct - req) / (b.toPct - b.fromPct);
    return n;
  }, 0));
}

/** Rounds to two significant digits. */
export const nice = (v: number) => (v > 0 && Number.isFinite(v) ? Number(v.toPrecision(2)) : 0);

/** Rounds down to two significant digits. */
export function niceFloor(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 0;
  const step = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Number((Math.floor(v / step) * step).toPrecision(2));
}

export function sanitizeDecimal(raw: string): string {
  const [whole, ...rest] = raw.replace(/[^0-9.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
}

export const sanitizeInt = (raw: string) => raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

/** Slider position on a logarithmic scale between `min` and `max`. */
export function toSliderPos(v: number, min: number, max: number): number {
  if (!(min > 0 && max > min) || !(v > min)) return 0;
  if (v >= max) return SLIDER_STEPS;
  return Math.round(SLIDER_STEPS * Math.log(v / min) / Math.log(max / min));
}

export function fromSliderPos(pos: number, min: number, max: number): number {
  if (!(min > 0 && max > min)) return 0;
  const clamped = Math.min(SLIDER_STEPS, Math.max(0, pos));
  return nice(min * Math.pow(max / min, clamped / SLIDER_STEPS));
}

export type SimulationInput = {
  budget: number; recipients: number; score: number;
  tokenPriceUsd: number | null; participationPct: number; minPerStageUsd: number;
  stageAlloc: number[]; stats: ScoreStats | null;
};

export type SimulationResult = {
  poolUsd: number | null;
  capacity: number | null;
  perRecipientUsd: number | null;
  perStageUsd: number[] | null;
  eligible: number | null;
  overCapacity: boolean;
  overEligible: boolean;
};

export function simulate(i: SimulationInput): SimulationResult {
  const price = i.tokenPriceUsd !== null && i.tokenPriceUsd > 0 && Number.isFinite(i.tokenPriceUsd) ? i.tokenPriceUsd : null;
  const budget = Math.max(0, Number.isFinite(i.budget) ? i.budget : 0);
  const recipients = Math.max(0, Math.floor(Number.isFinite(i.recipients) ? i.recipients : 0));
  const score = Math.min(100, Math.max(0, Number.isFinite(i.score) ? i.score : 0));
  const alloc = i.stageAlloc.map(v => (v > 0 && Number.isFinite(v) ? v : 0));
  const allocTotal = alloc.reduce((a, b) => a + b, 0);
  const rewardedStages = alloc.filter(v => v > 0).length || alloc.length || 1;

  const poolUsd = price !== null ? budget * price * i.participationPct / 100 : null;
  const minPerRecipient = i.minPerStageUsd * rewardedStages;
  const capacity = poolUsd !== null && minPerRecipient > 0 ? Math.floor(poolUsd / minPerRecipient) : null;
  const perRecipientUsd = poolUsd !== null && recipients > 0 ? poolUsd / recipients : null;
  const perStageUsd = perRecipientUsd !== null && allocTotal > 0 ? alloc.map(v => perRecipientUsd * v / allocTotal) : null;
  const eligible = i.stats?.buckets.length ? eligibleAt(i.stats, score) : null;

  return {
    poolUsd, capacity, perRecipientUsd, perStageUsd, eligible,
    overCapacity: capacity !== null && recipients > capacity,
    overEligible: eligible !== null && recipients > eligible,
  };
}

/** Recipients a preset should set: the most the pool and the eligible audience both allow, rounded down. */
export function presetRecipients(capacity: number | null, eligible: number | null): number | null {
  const limits = [capacity, eligible].filter((v): v is number => v !== null && v > 0);
  return limits.length ? niceFloor(Math.min(...limits)) : null;
}
