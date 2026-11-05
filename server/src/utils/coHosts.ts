/*
 * Co-hosted campaigns: rules shared by the co-host endpoints, governance and campaign saves.
 *
 * - The host invites a studio; the studio's signers accept through governance.
 * - Each partner builds and owns its own stages. A save only ever changes the saver's stages
 *   and their tasks; a partner's stages are kept exactly as stored.
 * - Each partner funds the rewards for its own stages and pays an equal share of the launch fee.
 * - A co-host marks its stages ready; that locks the reward settings for both partners.
 * - Neither side can stall the other: a co-host has PARTNER_DEADLINE_MS after accepting to get
 *   ready, and the host has PARTNER_DEADLINE_MS after that to launch. Otherwise it lapses and any
 *   held payment becomes refundable.
 */

export const MAX_CO_HOSTS = 1;
export const CO_HOST_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const PARTNER_DEADLINE_MS = 14 * 24 * 60 * 60 * 1000;

export type CoHostStatus = "invited" | "accepted" | "declined" | "lapsed";
export type CoHostFeeStatus = "none" | "held" | "settled" | "refundDue" | "refunded";
export type CoHostEntry = {
  hub: unknown; status: CoHostStatus; invitedAt: Date | string;
  respondedAt?: Date | string | null; ready?: boolean; readyAt?: Date | string | null;
  stageKeys?: string[]; feeStatus?: CoHostFeeStatus;
};
export type Stage = { key: string; name?: string; returnDays?: number; allocationPct?: number | null; owner?: string | null; order?: number };

const id = (v: unknown) => String(v ?? "");
const time = (v: unknown) => (v ? new Date(v as string).getTime() : NaN);

export function isInviteExpired(entry: Pick<CoHostEntry, "status" | "invitedAt">, now = Date.now()): boolean {
  const at = time(entry.invitedAt);
  return entry.status === "invited" && (!Number.isFinite(at) || now - at > CO_HOST_INVITE_TTL_MS);
}

/** Co-hosts still part of the campaign: accepted, or invited and not expired. */
export const activeCoHosts = <T extends CoHostEntry>(list: T[] | undefined, now = Date.now()): T[] =>
  (list ?? []).filter(c => c.status === "accepted" || (c.status === "invited" && !isInviteExpired(c, now)));

/** True when an accepted co-host on a draft missed its deadline: to get ready, or (once ready) for the launch. */
export function partnershipLapsed(entry: Pick<CoHostEntry, "status" | "respondedAt" | "ready" | "readyAt">, campaignStatus: string, now = Date.now()): boolean {
  if (entry.status !== "accepted" || campaignStatus !== "Save") return false;
  const from = time(entry.ready ? entry.readyAt : entry.respondedAt);
  return Number.isFinite(from) && now - from > PARTNER_DEADLINE_MS;
}

/** A held payment becomes refundable when the partner leaves a draft or the partnership lapses. */
export const feeOnExit = (fee: CoHostFeeStatus | undefined): CoHostFeeStatus => (fee === "held" ? "refundDue" : fee ?? "none");

/** Why a new co-host can't be invited, or null. */
export function inviteProblem(opts: { hostHubId: string; targetHubId: string; campaignStatus: string; coHosts: CoHostEntry[] | undefined; targetIsSystem: boolean }, now = Date.now()): string | null {
  if (opts.campaignStatus !== "Save") return "co-hosts can only be invited while the campaign is a draft";
  if (opts.targetHubId === opts.hostHubId) return "you can't invite your own studio";
  if (opts.targetIsSystem) return "this studio can't co-host campaigns";
  const active = activeCoHosts(opts.coHosts, now);
  if (active.some(c => id(c.hub) === opts.targetHubId)) return "this studio is already invited";
  if (active.length >= MAX_CO_HOSTS) return `a campaign can have ${MAX_CO_HOSTS} co-host${MAX_CO_HOSTS === 1 ? "" : "s"} for now`;
  return null;
}

/** Owner of a stage: "" for the host, otherwise the co-host studio's id. */
export const ownerOf = (s: Pick<Stage, "owner">) => id(s.owner);

/** Keys of stages the saver doesn't own, so its save can't touch them or their tasks. */
export const partnerStageKeys = (stored: Stage[], saver: string): Set<string> =>
  new Set(stored.filter(s => ownerOf(s) !== saver).map(s => s.key));

/**
 * The campaign's stages after a save by `saver` ("" for the host). The saver's own stages come from
 * the save; everyone else's are kept as stored. Before any co-host is ready the host also sets the
 * reward share (allocationPct) of every stage. Stages are ordered host first, then each co-host.
 */
export function mergeStages(opts: { stored: Stage[]; incoming: Stage[]; saver: string; coHostOrder: string[]; hostSetsAllocation: boolean }): Stage[] {
  const { stored, incoming, saver, coHostOrder, hostSetsAllocation } = opts;
  const taken = partnerStageKeys(stored, saver);
  const incomingByKey = new Map(incoming.map(s => [s.key, s]));
  const mine = incoming.filter(s => s.key && !taken.has(s.key)).map(s => ({ ...s, owner: saver }));
  const theirs = stored.filter(s => ownerOf(s) !== saver).map(s => {
    const share = incomingByKey.get(s.key)?.allocationPct;
    return saver === "" && hostSetsAllocation && share !== undefined ? { ...s, allocationPct: share } : { ...s };
  });
  const rank = (owner: string) => (owner === "" ? -1 : coHostOrder.indexOf(owner) === -1 ? coHostOrder.length : coHostOrder.indexOf(owner));
  const all = [...mine, ...theirs];
  return all
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(ownerOf(a.s)) - rank(ownerOf(b.s)) || a.i - b.i)
    .map(({ s }, order) => ({ ...s, order }));
}

/** Why a co-host can't mark its stages ready, or null. */
export function readyProblem(myStageKeys: string[], quests: Array<{ stage?: unknown }>): string | null {
  if (!myStageKeys.length) return "add at least one stage before marking your part ready";
  const withTasks = new Set(quests.map(q => id(q.stage)));
  if (myStageKeys.some(k => !withTasks.has(k))) return "every one of your stages needs at least one task";
  return null;
}

/** Why the campaign can't be published yet because of its co-hosts, or null. */
export function coHostPublishProblem(list: CoHostEntry[] | undefined, names: Record<string, string> = {}, now = Date.now()): string | null {
  const name = (c: CoHostEntry) => names[id(c.hub)] || "your co-host";
  const active = activeCoHosts(list, now);
  const invited = active.filter(c => c.status === "invited");
  if (invited.length) return `${invited.map(name).join(" and ")} hasn't accepted the co-host invitation yet`;
  const building = active.filter(c => c.status === "accepted" && !c.ready);
  if (building.length) return `${building.map(name).join(" and ")} hasn't marked its stages ready yet`;
  return null;
}

/**
 * Each partner's share of the reward budget: the budget times the allocation of the stages it
 * owns. Amounts are in the smallest unit; the host covers any rounding remainder.
 */
export function rewardShares(budgetWei: bigint, stages: Stage[]): Map<string, bigint> {
  const shares = new Map<string, bigint>([["", 0n]]);
  const BPS = 10_000n;
  let given = 0n;
  for (const s of stages) {
    const pct = Number(s.allocationPct);
    if (!(pct > 0) || ownerOf(s) === "") continue;
    const amount = budgetWei * BigInt(Math.round(pct * 100)) / BPS;
    shares.set(ownerOf(s), (shares.get(ownerOf(s)) ?? 0n) + amount);
    given += amount;
  }
  shares.set("", budgetWei - given);
  return shares;
}

/** True when a save changes the reward settings a ready co-host committed to. */
export function rewardSettingsChanged(before: { rewardsConfig?: any; stages: Stage[] }, after: { rewardsConfig?: any; stages: Stage[] | null }): boolean {
  const pick = (rc: any) => ["budget", "token", "network", "recipients"].map(k => String(rc?.[k] ?? "")).join("|");
  if (after.rewardsConfig !== undefined && pick(before.rewardsConfig) !== pick(after.rewardsConfig)) return true;
  if (!after.stages) return false;
  const shares = (list: Stage[]) => new Map(list.map(s => [s.key, String(s.allocationPct ?? "")]));
  const was = shares(before.stages);
  const now = shares(after.stages);
  return [...was.keys()].some(k => now.has(k) && now.get(k) !== was.get(k)) || [...now.keys()].some(k => !was.has(k) && Number(now.get(k)) > 0);
}

/**
 * Splits a fee equally between the host and its accepted co-hosts. Amounts are in the smallest
 * unit (wei) so nothing is lost to rounding; the host covers any remainder.
 */
export function splitFee(totalWei: bigint, partners: number): { host: bigint; coHost: bigint } {
  if (totalWei < 0n) throw new Error("fee can't be negative");
  const n = BigInt(Math.max(1, Math.floor(partners)));
  const each = totalWei / n;
  return { host: totalWei - each * (n - 1n), coHost: each };
}
