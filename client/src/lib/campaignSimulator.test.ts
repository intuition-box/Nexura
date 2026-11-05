import { describe, expect, test } from "bun:test";
import {
  MAX_BUDGET_USD, MIN_BUDGET_USD, SLIDER_STEPS, eligibleAt, fromSliderPos, nice, niceFloor,
  presetRecipients, sanitizeDecimal, sanitizeInt, simulate, toSliderPos, type ScoreStats,
} from "./campaignSimulator";

const stats: ScoreStats = {
  totalUsers: 1000,
  buckets: [
    { fromPct: 0, toPct: 50, users: 600 },
    { fromPct: 50, toPct: 80, users: 300 },
    { fromPct: 80, toPct: 100, users: 100 },
  ],
};

const base = { budget: 1000, recipients: 100, score: 0, tokenPriceUsd: 1, participationPct: 72, minPerStageUsd: 2, stageAlloc: [50, 50], stats };

describe("eligibleAt", () => {
  test("counts everyone at 0%", () => expect(eligibleAt(stats, 0)).toBe(1000));
  test("counts whole buckets at a boundary", () => expect(eligibleAt(stats, 80)).toBe(100));
  test("prorates the bucket the requirement falls inside", () => expect(eligibleAt(stats, 65)).toBe(250));
  test("is 0 above every bucket", () => expect(eligibleAt(stats, 101)).toBe(0));
  test("handles missing data", () => expect(eligibleAt(null, 50)).toBe(0));
  test("ignores negative or invalid bucket counts", () =>
    expect(eligibleAt({ totalUsers: 0, buckets: [{ fromPct: 0, toPct: 100, users: -50 }, { fromPct: 0, toPct: 100, users: NaN }] }, 0)).toBe(0));
});

describe("rounding", () => {
  test("nice keeps two significant digits", () => {
    expect(nice(1234)).toBe(1200);
    expect(nice(0.03333)).toBe(0.033);
    expect(nice(0)).toBe(0);
    expect(nice(-5)).toBe(0);
    expect(nice(Infinity)).toBe(0);
  });
  test("niceFloor never rounds up", () => {
    expect(niceFloor(1999)).toBe(1900);
    expect(niceFloor(0.0479)).toBe(0.047);
    expect(niceFloor(7)).toBe(7);
    expect(niceFloor(NaN)).toBe(0);
  });
});

describe("sanitizers", () => {
  test("decimal keeps one dot", () => expect(sanitizeDecimal("1.2.3abc")).toBe("1.23"));
  test("decimal strips letters and signs", () => expect(sanitizeDecimal("-$1,000")).toBe("1000"));
  test("int strips everything but digits and leading zeros", () => {
    expect(sanitizeInt("0012e3")).toBe("123");
    expect(sanitizeInt("0")).toBe("0");
  });
});

describe("slider mapping", () => {
  test("round-trips across the range", () => {
    for (const v of [100, 950, 12_000, 400_000]) {
      const back = fromSliderPos(toSliderPos(v, MIN_BUDGET_USD, MAX_BUDGET_USD), MIN_BUDGET_USD, MAX_BUDGET_USD);
      expect(Math.abs(back - v) / v).toBeLessThan(0.05);
    }
  });
  test("clamps out-of-range values", () => {
    expect(toSliderPos(1, 100, 1000)).toBe(0);
    expect(toSliderPos(10_000, 100, 1000)).toBe(SLIDER_STEPS);
    expect(fromSliderPos(-50, 100, 1000)).toBe(100);
    expect(fromSliderPos(SLIDER_STEPS * 2, 100, 1000)).toBe(1000);
  });
  test("reaches fractional amounts for high-priced tokens", () => {
    const min = nice(MIN_BUDGET_USD / 3000);
    expect(min).toBeGreaterThan(0);
    expect(min).toBeLessThan(1);
  });
  test("rejects a broken range", () => {
    expect(toSliderPos(5, 0, 10)).toBe(0);
    expect(fromSliderPos(500, 10, 10)).toBe(0);
  });
});

describe("simulate", () => {
  test("splits the participation pool", () => {
    const r = simulate(base);
    expect(r.poolUsd).toBe(720);
    expect(r.perRecipientUsd).toBe(7.2);
    expect(r.perStageUsd).toEqual([3.6, 3.6]);
    expect(r.capacity).toBe(180);
    expect(r.overCapacity).toBe(false);
  });
  test("flags more recipients than the pool covers", () => expect(simulate({ ...base, recipients: 500 }).overCapacity).toBe(true));
  test("flags more recipients than eligible users", () => expect(simulate({ ...base, score: 80, recipients: 150 }).overEligible).toBe(true));
  test("needs a price for USD values", () => {
    const r = simulate({ ...base, tokenPriceUsd: null });
    expect(r.poolUsd).toBeNull();
    expect(r.capacity).toBeNull();
    expect(r.perRecipientUsd).toBeNull();
  });
  test("survives zero and garbage input", () => {
    const r = simulate({ ...base, budget: NaN, recipients: -3, score: 400, tokenPriceUsd: Infinity, stageAlloc: [] });
    expect(r.poolUsd).toBeNull();
    expect(r.perRecipientUsd).toBeNull();
    expect(r.perStageUsd).toBeNull();
  });
  test("ignores stages at 0% when sizing capacity", () => expect(simulate({ ...base, stageAlloc: [100, 0, 0] }).capacity).toBe(360));
  test("no per-stage split when nothing is allocated", () => expect(simulate({ ...base, stageAlloc: [0, 0] }).perStageUsd).toBeNull());
});

describe("presetRecipients", () => {
  test("takes the tighter limit, rounded down", () => expect(presetRecipients(1999, 5000)).toBe(1900));
  test("ignores missing limits", () => expect(presetRecipients(null, 250)).toBe(250));
  test("returns null with no limits", () => expect(presetRecipients(null, 0)).toBeNull());
});
