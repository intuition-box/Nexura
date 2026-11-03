import mongoose from "mongoose";
import logger from "@/config/logger";
import { campaign, campaignCompleted } from "@/models/campaign.model";
import { performIntuitionOnchainAction } from "@/utils/account";
import { runExclusively } from "@/utils/jobLock";
import { user } from "@/models/user.model";
import { campaignRewardAsset, defaultRewardAsset, isTrustAsset, rewardAssetUnavailable, rewardContractFor, rewardTotalKey } from "@/utils/rewardAssets";
import { computeRetention } from "@/utils/retention";

/*
 * TRUST (monetary) reward eligibility. Anyone can join a campaign and earn its XP; only eligible
 * participants can claim the TRUST reward. Someone is eligible once they joined the campaign and
 * their Nexura score meets the minimum the project set (no minimum = no requirement).
 * Being eligible doesn't reserve a place: places go first come, first served to eligible people
 * who claim while places are left. Once eligible they stay eligible (on-chain campaigns are told the
 * wallet may claim at that moment). A scheduled job re-checks participants so people find out
 * without doing anything.
 */

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

export type TrustEligibility = {
  hasTrustReward: boolean;
  joined: boolean;
  /** The project's minimum Nexura score (%), or null when it set none */
  required: number | null;
  /** The person's Nexura score (%), or null before any campaign counts */
  current: number | null;
  /** Eligible and places are still left, so they can claim now */
  eligible: boolean;
  claimed: boolean;
  /** Why they can't claim the reward (yet), in words for the person; null when they can */
  reason: string | null;
  /** What the reward pays in, e.g. "TRUST" or "USDC", and on which network */
  token: string;
  network: string;
};

const CAMPAIGN_FIELDS = "reward totalTrustAvailable trustClaimed contractAddress rewardsConfig rewardAsset stages status ends_at";

export const campaignHasTrust = (c: any) =>
  Number(c?.reward?.trustTokens ?? 0) > 0 || (!!c?.contractAddress && Number(c?.totalTrustAvailable ?? 0) > 0);

/** The project's minimum Nexura score, or null when it didn't set one. */
export const nexuraScoreRequirement = (c: any): number | null => {
  const n = Number(c?.rewardsConfig?.nexuraScoreRequirementPct ?? c?.rewardsConfig?.retentionRequirementPct);
  return Number.isFinite(n) && n > 0 ? Math.min(100, n) : null;
};

/** TRUST already paid on this campaign (including a one-lump claim from before stage payouts). */
const alreadyClaimed = (j: any) => !!j?.trustRewardClaimed || (!!j?.campaignCompleted && !(j?.xpStagesPaid?.length));

/**
 * Works out whether a person can claim this campaign's TRUST reward, records what was found (so the
 * campaign page can show their progress), and grants eligibility the first time they qualify.
 * `nexuraScore` can be passed in when it's already computed (the scheduled job does them in batches).
 */
export async function checkTrustEligibility(userId: unknown, campaignId: unknown, nexuraScore?: number | null): Promise<TrustEligibility> {
  // Without a real person the lookups below would match someone else's records
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
    const d = defaultRewardAsset();
    return { hasTrustReward: false, joined: false, required: null, current: null, eligible: false, claimed: false, reason: "Sign in to see your reward progress.", token: d.token, network: d.network };
  }
  const c = await campaign.findById(campaignId).select(CAMPAIGN_FIELDS).lean() as any;
  const join = c ? await campaignCompleted.findOne({ user: userId, campaign: campaignId }).lean() as any : null;
  const required = nexuraScoreRequirement(c);
  const asset = campaignRewardAsset(c);
  const sym = asset.token;
  const base: TrustEligibility = { hasTrustReward: campaignHasTrust(c), joined: !!join, required, current: null, eligible: false, claimed: false, reason: null, token: sym, network: asset.network };

  if (!c || !base.hasTrustReward) return { ...base, reason: "This campaign has no token reward." };
  if (!join) return { ...base, reason: `Join the campaign to work towards the ${sym} reward.` };
  // Rewards in an asset whose contract isn't live yet can't be claimed
  const unavailable = rewardAssetUnavailable(asset);
  if (unavailable) return { ...base, reason: unavailable };

  const claimed = alreadyClaimed(join);
  const current = nexuraScore !== undefined
    ? nexuraScore
    : ((await computeRetention([String(userId)])).get(String(userId))?.nexuraScore ?? null);
  const meetsNexuraScore = required === null || (current ?? 0) >= required;
  // First come, first served: eligibility holds no place, so it only matters while places are left
  const perPerson = Number(c.reward?.trustTokens ?? 0);
  const placesLeft = Number(c.trustClaimed ?? 0) + Math.max(perPerson, 0) <= Number(c.totalTrustAvailable ?? 0)
    && Number(c.trustClaimed ?? 0) < Number(c.totalTrustAvailable ?? 0);

  await campaignCompleted.updateOne({ _id: join._id }, { $set: { rewardCheck: { required, current, checkedAt: new Date() } } });

  // Once eligible, they stay eligible
  let qualified = !!join.trustEligible;
  if (!qualified && meetsNexuraScore && placesLeft && !claimed) qualified = await grantTrustEligibility(userId, c, join._id);

  let reason: string | null = null;
  if (claimed) reason = `You've already claimed this campaign's ${sym} reward.`;
  else if (!placesLeft) reason = `All the ${sym} reward places for this campaign have been taken.`;
  else if (!qualified) reason = required !== null
    ? `You need ${required}% Nexura score to qualify for the ${sym} reward. You're at ${current ?? 0}%.`
    : `Your ${sym} claim couldn't be set up yet. Try again in a few minutes.`;
  return { ...base, current, eligible: qualified && placesLeft && !claimed, claimed, reason };
}

/** Marks the person eligible exactly once, and lets their wallet claim on an on-chain campaign. */
async function grantTrustEligibility(userId: unknown, c: any, joinId: unknown): Promise<boolean> {
  const won = await campaignCompleted.findOneAndUpdate(
    { _id: joinId, trustEligible: { $ne: true } },
    { $set: { trustEligible: true, trustEligibleAt: new Date() } },
  );
  if (!won) return true; // granted already (another request or the scheduled job)
  if (c.contractAddress) {
    try {
      await allowClaimOnChain(c, userId);
    } catch (err) {
      // Not allowed on-chain: undo, so the next check tries again
      await campaignCompleted.updateOne({ _id: joinId }, { $set: { trustEligible: false, trustEligibleAt: null } });
      logger.error(`allow-claim failed for user ${String(userId)} on campaign ${String(c._id)}: ${(err as any)?.message ?? err}`);
      return false;
    }
  }
  return true;
}

/**
 * Lets the person's wallet claim from the campaign's rewards contract. Intuition (TRUST) uses the
 * existing contract; other networks plug in here once their contracts are deployed.
 */
async function allowClaimOnChain(c: any, userId: unknown): Promise<void> {
  const asset = campaignRewardAsset(c);
  const contract = rewardContractFor(asset.network);
  if (!contract) throw new Error(`no rewards contract for ${asset.networkName} yet`);
  if (contract.builtIn) {
    await performIntuitionOnchainAction({ action: "allow-claim", userId: String(userId), contractAddress: c.contractAddress });
    return;
  }
  // TODO when the multi-chain rewards contract is deployed: call its allow-claim on asset.network
  // (contract.address via contract.rpcUrl, signed with the server wallet). Until then this refuses,
  // and publishing such campaigns is blocked, so it isn't reached.
  throw new Error(`the ${asset.networkName} rewards contract integration isn't built yet`);
}

/**
 * Records a reward paid to a person, in the campaign's asset. TRUST adds to trustEarned as before;
 * other assets add to rewardsEarned["<network>:<token>"] as exact decimals.
 */
export async function creditReward(userId: unknown, c: any, amount: number): Promise<void> {
  if (!(amount > 0)) return;
  const asset = campaignRewardAsset(c);
  if (isTrustAsset(asset)) {
    await user.updateOne({ _id: userId }, { $inc: { trustEarned: amount } });
    return;
  }
  // Stored as an exact decimal. At most 9 places: amounts arrive as ordinary numbers, and more places
  // would carry their floating-point noise (0.1 → "0.100000000000000006")
  const exact = amount.toFixed(Math.min(asset.decimals, 9));
  await user.updateOne({ _id: userId }, { $inc: { [`rewardsEarned.${rewardTotalKey(asset)}`]: mongoose.Types.Decimal128.fromString(exact) } });
}

/** Re-checks everyone still working towards a token reward on live campaigns. Never throws. */
export async function runTrustEligibilityCheck(): Promise<void> {
  try {
    const now = Date.now();
    const live = (await campaign.find({ status: { $in: ["Active", "Scheduled"] }, deletedAt: null }).select(CAMPAIGN_FIELDS).lean() as any[])
      .filter(c => campaignHasTrust(c) && !(c.ends_at && new Date(c.ends_at).getTime() <= now));
    let granted = 0;
    for (const c of live) {
      const joins = await campaignCompleted.find({ campaign: c._id, trustEligible: { $ne: true }, trustRewardClaimed: { $ne: true } })
        .select("user").lean() as any[];
      if (!joins.length) continue;
      const scores = await computeRetention(joins.map(j => String(j.user)));
      for (const j of joins) {
        const r = await checkTrustEligibility(j.user, c._id, scores.get(String(j.user))?.nexuraScore ?? null);
        if (r.eligible) granted++;
      }
    }
    if (granted) logger.info(`TRUST eligibility check: ${granted} participant(s) eligible`);
  } catch (err) {
    logger.error(`TRUST eligibility check failed: ${(err as any)?.message ?? err}`);
  }
}

/** Runs the eligibility check every 10 minutes, on one server at a time. */
export function startTrustEligibilityCron() {
  const run = () => runExclusively("trust-eligibility", CHECK_INTERVAL_MS - 30_000, runTrustEligibilityCheck);
  void run();
  setInterval(() => { void run(); }, CHECK_INTERVAL_MS);
  logger.info("TRUST eligibility check started (10m interval)");
}
