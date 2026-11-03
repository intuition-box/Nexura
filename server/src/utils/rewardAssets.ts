import { network as serverNetwork } from "@/utils/env.utils";

/*
 * Reward pool assets, matching the Studio campaign builder (client: NETWORKS in CreateNewCampaign.tsx).
 *
 * Only TRUST on Intuition has a rewards contract today. Every other network stays switched off until
 * its contract is deployed: set REWARD_CONTRACT_<NETWORK> (the factory/rewards contract address) and
 * RPC_URL_<NETWORK>, e.g. REWARD_CONTRACT_BASE=0x… and RPC_URL_BASE=https://…, then restart. Nothing
 * else in the code has to change for a network to open.
 *
 * Token addresses: native coins have none. ERC-20 addresses below are the official ones; any of them
 * can be overridden with TOKEN_<NETWORK>_<SYMBOL>=0x…. A token without an address can't be enabled.
 */

export type RewardNetworkId = "intuition-testnet" | "intuition" | "arbitrum" | "base" | "ethereum" | "bnb" | "robinhood";

type TokenInfo = { decimals: number; native?: boolean; address?: string | null };
type NetworkInfo = { name: string; chainId: number | null; tokens: Record<string, TokenInfo>; builtInContract?: boolean };

const REGISTRY: Record<RewardNetworkId, NetworkInfo> = {
  "intuition-testnet": { name: "Intuition Testnet", chainId: 13579, builtInContract: true, tokens: { tTRUST: { decimals: 18, native: true } } },
  intuition: { name: "Intuition Mainnet", chainId: 1155, builtInContract: true, tokens: { TRUST: { decimals: 18, native: true } } },
  arbitrum: { name: "Arbitrum", chainId: 42161, tokens: {
    ETH: { decimals: 18, native: true },
    USDC: { decimals: 6, address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    USDT: { decimals: 6, address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
  } },
  base: { name: "Base", chainId: 8453, tokens: {
    ETH: { decimals: 18, native: true },
    USDC: { decimals: 6, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    // TRUST on Base: set TOKEN_BASE_TRUST once the address to accept is confirmed
    TRUST: { decimals: 18, address: null },
  } },
  ethereum: { name: "Ethereum", chainId: 1, tokens: {
    ETH: { decimals: 18, native: true },
    USDC: { decimals: 6, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    USDT: { decimals: 6, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  } },
  bnb: { name: "BNB Chain", chainId: 56, tokens: {
    BNB: { decimals: 18, native: true },
    // BNB Chain's USDT and USDC use 18 decimals, unlike most chains
    USDT: { decimals: 18, address: "0x55d398326f99059fF775485246999027B3197955" },
    USDC: { decimals: 18, address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
  } },
  // Chain id isn't fixed yet: set CHAIN_ID_ROBINHOOD with the rest of its configuration
  robinhood: { name: "Robinhood Chain", chainId: null, tokens: { ETH: { decimals: 18, native: true } } },
};

const envKey = (network: string) => network.toUpperCase().replace(/[^A-Z0-9]/g, "_");
const envAddress = (name: string) => {
  const v = process.env[name]?.trim();
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? v : null;
};

export type RewardAsset = {
  network: RewardNetworkId;
  networkName: string;
  chainId: number | null;
  token: string;
  decimals: number;
  native: boolean;
  tokenAddress: string | null;
};

export const isRewardNetwork = (n: unknown): n is RewardNetworkId => typeof n === "string" && n in REGISTRY;

/** The asset for a network/token pair from the builder, or null when that pair isn't offered. */
export function rewardAsset(network: unknown, token: unknown): RewardAsset | null {
  if (!isRewardNetwork(network) || typeof token !== "string") return null;
  const net = REGISTRY[network];
  const t = net.tokens[token];
  if (!t) return null;
  const chainId = net.chainId ?? (Number(process.env[`CHAIN_ID_${envKey(network)}`]) || null);
  return {
    network, networkName: net.name, chainId, token, decimals: t.decimals, native: !!t.native,
    tokenAddress: t.native ? null : (envAddress(`TOKEN_${envKey(network)}_${token}`) ?? t.address ?? null),
  };
}

/** TRUST on the Intuition network this server runs against: the asset campaigns used before multi-asset. */
export function defaultRewardAsset(): RewardAsset {
  return serverNetwork === "mainnet" ? rewardAsset("intuition", "TRUST")! : rewardAsset("intuition-testnet", "tTRUST")!;
}

/** A campaign's reward asset (older campaigns without one pay TRUST on Intuition). */
export function campaignRewardAsset(c: any): RewardAsset {
  const stored = c?.rewardAsset;
  return rewardAsset(stored?.network ?? c?.rewardsConfig?.network, stored?.token ?? c?.rewardsConfig?.token) ?? defaultRewardAsset();
}

/** The rewards contract for a network, if it's live; null means rewards there aren't open yet. */
export function rewardContractFor(network: RewardNetworkId): { address: string | null; rpcUrl: string | null; builtIn: boolean } | null {
  if (REGISTRY[network]?.builtInContract) return { address: null, rpcUrl: null, builtIn: true };
  const address = envAddress(`REWARD_CONTRACT_${envKey(network)}`);
  const rpcUrl = process.env[`RPC_URL_${envKey(network)}`]?.trim() || null;
  return address && rpcUrl ? { address, rpcUrl, builtIn: false } : null;
}

/** Why rewards in this asset can't be offered yet (in words for a project), or null when they can. */
export function rewardAssetUnavailable(asset: RewardAsset): string | null {
  if (!rewardContractFor(asset.network)) return `Rewards in ${asset.token} on ${asset.networkName} aren't available yet. They open once the ${asset.networkName} rewards contract is live.`;
  if (!asset.native && !asset.tokenAddress) return `Rewards in ${asset.token} on ${asset.networkName} aren't available yet.`;
  if (asset.chainId === null) return `Rewards on ${asset.networkName} aren't available yet.`;
  // The Intuition contract pays the native coin of the network this server runs on
  if (REGISTRY[asset.network].builtInContract && asset.network !== defaultRewardAsset().network) {
    return `This server runs on ${defaultRewardAsset().networkName}, so rewards on ${asset.networkName} can't be used here.`;
  }
  return null;
}

/** Key for per-asset reward totals on a user, e.g. "base:USDC" (Mongo map keys can't contain dots). */
export const rewardTotalKey = (asset: RewardAsset) => `${asset.network}:${asset.token}`;

/** TRUST rewards keep using the existing trustEarned field. */
export const isTrustAsset = (asset: RewardAsset) => asset.token === "TRUST" || asset.token === "tTRUST";
