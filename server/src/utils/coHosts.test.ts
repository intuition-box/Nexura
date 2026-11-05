import { describe, expect, test } from "bun:test";
import {
  CO_HOST_INVITE_TTL_MS, PARTNER_DEADLINE_MS, activeCoHosts, coHostPublishProblem, feeOnExit, inviteProblem, isInviteExpired,
  mergeStages, partnerStageKeys, partnershipLapsed, readyProblem, rewardSettingsChanged, rewardShares, splitFee, type Stage,
} from "./coHosts";

const now = Date.UTC(2026, 10, 4);
const fresh = new Date(now - 1000);
const stale = new Date(now - CO_HOST_INVITE_TTL_MS - 1000);
const base = { hostHubId: "a", targetHubId: "b", campaignStatus: "Save", coHosts: [], targetIsSystem: false };

describe("invites", () => {
  test("allows a first co-host on a draft", () => expect(inviteProblem(base, now)).toBeNull());
  test("refuses after publishing", () => expect(inviteProblem({ ...base, campaignStatus: "Active" }, now)).toMatch(/draft/));
  test("refuses the host itself", () => expect(inviteProblem({ ...base, targetHubId: "a" }, now)).toMatch(/own studio/));
  test("refuses system studios", () => expect(inviteProblem({ ...base, targetIsSystem: true }, now)).toMatch(/can't co-host/));
  test("refuses a duplicate", () =>
    expect(inviteProblem({ ...base, coHosts: [{ hub: "b", status: "invited", invitedAt: fresh }] }, now)).toMatch(/already invited/));
  test("enforces the co-host limit", () =>
    expect(inviteProblem({ ...base, targetHubId: "c", coHosts: [{ hub: "b", status: "accepted", invitedAt: fresh }] }, now)).toMatch(/1 co-host/));
  test("an expired or declined invite frees the slot", () => {
    expect(inviteProblem({ ...base, targetHubId: "c", coHosts: [{ hub: "b", status: "invited", invitedAt: stale }] }, now)).toBeNull();
    expect(inviteProblem({ ...base, targetHubId: "c", coHosts: [{ hub: "b", status: "declined", invitedAt: fresh }] }, now)).toBeNull();
  });
  test("expiry only applies to open invites", () => {
    expect(isInviteExpired({ status: "invited", invitedAt: stale }, now)).toBe(true);
    expect(isInviteExpired({ status: "accepted", invitedAt: stale }, now)).toBe(false);
    expect(isInviteExpired({ status: "invited", invitedAt: "not a date" }, now)).toBe(true);
  });
  test("active list drops declined and expired", () =>
    expect(activeCoHosts([
      { hub: "b", status: "accepted", invitedAt: stale },
      { hub: "c", status: "declined", invitedAt: fresh },
      { hub: "d", status: "invited", invitedAt: stale },
    ], now).map(c => c.hub)).toEqual(["b"]));
});

describe("deadlines", () => {
  const ago = (ms: number) => new Date(now - ms);
  test("a co-host still building within the deadline is fine", () =>
    expect(partnershipLapsed({ status: "accepted", respondedAt: ago(1000) }, "Save", now)).toBe(false));
  test("a co-host that never gets ready lapses", () =>
    expect(partnershipLapsed({ status: "accepted", respondedAt: ago(PARTNER_DEADLINE_MS + 1000) }, "Save", now)).toBe(true));
  test("once ready, the clock restarts for the host's launch", () => {
    expect(partnershipLapsed({ status: "accepted", respondedAt: ago(PARTNER_DEADLINE_MS * 2), ready: true, readyAt: ago(1000) }, "Save", now)).toBe(false);
    expect(partnershipLapsed({ status: "accepted", respondedAt: ago(PARTNER_DEADLINE_MS * 3), ready: true, readyAt: ago(PARTNER_DEADLINE_MS + 1000) }, "Save", now)).toBe(true);
  });
  test("a launched campaign never lapses", () =>
    expect(partnershipLapsed({ status: "accepted", respondedAt: ago(PARTNER_DEADLINE_MS * 3) }, "Active", now)).toBe(false));
  test("a held fee becomes refundable on exit; others are left alone", () => {
    expect(feeOnExit("held")).toBe("refundDue");
    expect(feeOnExit("settled")).toBe("settled");
    expect(feeOnExit(undefined)).toBe("none");
  });
});

describe("each partner owns its stages", () => {
  const stored: Stage[] = [
    { key: "h1", name: "Join", owner: "", allocationPct: 50 },
    { key: "c1", name: "Partner week", owner: "B", allocationPct: 50 },
  ];
  test("the host's save can't change or remove the co-host's stage", () => {
    const out = mergeStages({ stored, incoming: [{ key: "h1", name: "Start", allocationPct: 50 }], saver: "", coHostOrder: ["B"], hostSetsAllocation: false });
    expect(out.map(s => [s.key, s.name, s.owner])).toEqual([["h1", "Start", ""], ["c1", "Partner week", "B"]]);
  });
  test("the host's save ignores edits it makes to the co-host's stage", () => {
    const out = mergeStages({ stored, incoming: [stored[0], { key: "c1", name: "Hijacked" }], saver: "", coHostOrder: ["B"], hostSetsAllocation: false });
    expect(out.find(s => s.key === "c1")?.name).toBe("Partner week");
  });
  test("the host sets every stage's reward share until the co-host is ready", () => {
    const incoming = [{ key: "h1", allocationPct: 70 }, { key: "c1", allocationPct: 30 }];
    expect(mergeStages({ stored, incoming, saver: "", coHostOrder: ["B"], hostSetsAllocation: true }).find(s => s.key === "c1")?.allocationPct).toBe(30);
    expect(mergeStages({ stored, incoming, saver: "", coHostOrder: ["B"], hostSetsAllocation: false }).find(s => s.key === "c1")?.allocationPct).toBe(50);
  });
  test("the co-host's save can't touch the host's stages", () => {
    const out = mergeStages({ stored, incoming: [{ key: "h1", name: "Hijacked" }, { key: "c1", name: "Week 1" }, { key: "c2", name: "Week 2" }], saver: "B", coHostOrder: ["B"], hostSetsAllocation: false });
    expect(out.map(s => [s.key, s.name, s.owner])).toEqual([["h1", "Join", ""], ["c1", "Week 1", "B"], ["c2", "Week 2", "B"]]);
  });
  test("the co-host can remove its own stage but not the host's", () => {
    const out = mergeStages({ stored, incoming: [], saver: "B", coHostOrder: ["B"], hostSetsAllocation: false });
    expect(out.map(s => s.key)).toEqual(["h1"]);
  });
  test("host stages always come first, and order is renumbered", () => {
    const out = mergeStages({ stored, incoming: [{ key: "h1" }, { key: "h2" }], saver: "", coHostOrder: ["B"], hostSetsAllocation: false });
    expect(out.map(s => [s.key, s.order])).toEqual([["h1", 0], ["h2", 1], ["c1", 2]]);
  });
  test("partner keys are everything the saver doesn't own", () => {
    expect([...partnerStageKeys(stored, "")]).toEqual(["c1"]);
    expect([...partnerStageKeys(stored, "B")]).toEqual(["h1"]);
  });
});

describe("ready and publishing", () => {
  test("ready needs a stage, and a task in every stage", () => {
    expect(readyProblem([], [])).toMatch(/at least one stage/);
    expect(readyProblem(["c1", "c2"], [{ stage: "c1" }])).toMatch(/every one/);
    expect(readyProblem(["c1"], [{ stage: "c1" }])).toBeNull();
  });
  test("publishing waits for acceptance, then for ready", () => {
    expect(coHostPublishProblem([{ hub: "b", status: "invited", invitedAt: fresh }], { b: "Acme" }, now)).toBe("Acme hasn't accepted the co-host invitation yet");
    expect(coHostPublishProblem([{ hub: "b", status: "accepted", invitedAt: fresh }], { b: "Acme" }, now)).toBe("Acme hasn't marked its stages ready yet");
    expect(coHostPublishProblem([{ hub: "b", status: "accepted", invitedAt: fresh, ready: true }], {}, now)).toBeNull();
  });
  test("no co-hosts or expired invites don't block", () => {
    expect(coHostPublishProblem(undefined, {}, now)).toBeNull();
    expect(coHostPublishProblem([{ hub: "b", status: "invited", invitedAt: stale }], {}, now)).toBeNull();
  });
});

describe("rewards", () => {
  const stages: Stage[] = [{ key: "h1", owner: "", allocationPct: 60 }, { key: "c1", owner: "B", allocationPct: 25 }, { key: "c2", owner: "B", allocationPct: 15 }];
  test("each partner funds its own stages", () => {
    const s = rewardShares(1000n, stages);
    expect(s.get("B")).toBe(400n);
    expect(s.get("")).toBe(600n);
  });
  test("nothing is lost to rounding; the host covers the remainder", () => {
    const s = rewardShares(1001n, [{ key: "h", owner: "", allocationPct: 66.67 }, { key: "c", owner: "B", allocationPct: 33.33 }]);
    expect((s.get("") ?? 0n) + (s.get("B") ?? 0n)).toBe(1001n);
  });
  test("a ready co-host's reward settings can't change", () => {
    const before = { rewardsConfig: { budget: 1000, token: "TRUST", network: "intuition", recipients: 100 }, stages };
    expect(rewardSettingsChanged(before, { rewardsConfig: { ...before.rewardsConfig }, stages })).toBe(false);
    expect(rewardSettingsChanged(before, { rewardsConfig: { ...before.rewardsConfig, budget: 500 }, stages: null })).toBe(true);
    expect(rewardSettingsChanged(before, { rewardsConfig: undefined, stages: [{ ...stages[0], allocationPct: 50 }, stages[1], stages[2]] })).toBe(true);
    expect(rewardSettingsChanged(before, { rewardsConfig: undefined, stages: [...stages, { key: "h2", allocationPct: 10 }] })).toBe(true);
    expect(rewardSettingsChanged(before, { rewardsConfig: undefined, stages: [...stages, { key: "h2", allocationPct: 0 }] })).toBe(false);
  });
});

describe("fee split", () => {
  test("splits equally", () => expect(splitFee(1000n, 2)).toEqual({ host: 500n, coHost: 500n }));
  test("host covers the remainder, nothing is lost", () => {
    const { host, coHost } = splitFee(1001n, 2);
    expect(host + coHost).toBe(1001n);
    expect(host).toBe(501n);
  });
  test("guards bad partner counts", () => expect(splitFee(10n, 0).host).toBe(10n));
  test("rejects a negative fee", () => expect(() => splitFee(-1n, 2)).toThrow());
});
