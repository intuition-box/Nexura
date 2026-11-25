import { createWalletClient, parseAbi, http, type WalletClient, type PublicClient, createPublicClient } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import logger from "@/config/logger";
import { OUTBOUND_TIMEOUT_MS } from "@/utils/resilience";
import { privateKeyToAccount } from "viem/accounts";
import { PRIVATE_KEY, network } from "./env.utils";
import { NexonsAddress, ETH_MAINNET_RPC } from "./constants";
import chain from "./chain.utils";
import { mainnet } from "viem/chains";

let walletClient: WalletClient | undefined = undefined;
let publicClient: PublicClient | undefined = undefined;

// The server wallet loads on first use: a missing or bad PRIVATE_KEY turns on-chain actions off, never the server
let account: PrivateKeyAccount | null | undefined;
if (!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY ?? "")) logger.warn("PRIVATE_KEY isn't set or isn't valid: on-chain actions (joins, reward claims) are off");

const getAccount = (): PrivateKeyAccount => {
	if (account === undefined) {
		try { account = privateKeyToAccount(PRIVATE_KEY); } catch { account = null; }
	}
	if (!account) throw new Error("the server wallet isn't configured (PRIVATE_KEY)");
	return account;
};

/** The server wallet's address, or null when PRIVATE_KEY isn't set up. */
export const serverWalletAddress = () => { try { return getAccount().address; } catch { return null; } };

const getWalletClient = () => {
	if (!walletClient) {
		walletClient = createWalletClient({
			account: getAccount(),
			chain,
			// A sent transaction is identified by its hash, so resending it after a timeout is safe
			transport: http(undefined, { timeout: OUTBOUND_TIMEOUT_MS, retryCount: 3 }),
		});
	}

	return walletClient;
};

export const getPublicClient = () => {
	if (!publicClient) {
		publicClient = createPublicClient({
			chain,
			transport: http(undefined, { timeout: OUTBOUND_TIMEOUT_MS, retryCount: 3 }),
		});
	}

	return publicClient;
};

let ethMainnetClient: PublicClient | undefined = undefined;

// Relics live on Ethereum mainnet, not the Intuition chain, so relic
// ownership checks must query an Ethereum-mainnet client.
export const getEthMainnetClient = () => {
	if (!ethMainnetClient) {
		ethMainnetClient = createPublicClient({
			chain: mainnet,
			transport: http(ETH_MAINNET_RPC, { timeout: OUTBOUND_TIMEOUT_MS, retryCount: 3 }),
		});
	}

	return ethMainnetClient;
};

export const getCampaignContractStartDate = async (contractAddress: string) => {
	const client = getPublicClient();

	const startDate = await client.readContract({
		address: contractAddress as GlobalAddress,
		abi: parseAbi(["function startDate() view returns (uint256)"]),
		functionName: "startDate",
	}) as bigint;

	return Number(startDate);
};

// The server wallet sends one transaction at a time, so simultaneous joins don't reuse a nonce.
// The nonce only moves on after a send succeeds, so a failed one leaves no gap behind it
let sendQueue: Promise<unknown> = Promise.resolve();
let lastNonce = { value: -1, at: 0 };
const NONCE_MEMORY_MS = 60_000;

async function nextNonce() {
	const pending = await getPublicClient().getTransactionCount({ address: getAccount().address, blockTag: "pending" });
	// An RPC node can lag behind the one that took our last transaction
	return Date.now() - lastNonce.at < NONCE_MEMORY_MS ? Math.max(pending, lastNonce.value + 1) : pending;
}

export const performIntuitionOnchainAction = (params: { action: string; userId: string; level?: string; contractAddress?: string }) => {
	const run = sendQueue.then(() => sendOnchainAction(params), () => sendOnchainAction(params));
	sendQueue = run.catch(() => {});
	return run;
};

const sendOnchainAction = async ({ action, contractAddress, userId, level }: { action: string; userId: string; level?: string; contractAddress?: string }) => {
	const call = ({
		"join": { address: contractAddress, fn: "function joinCampaign(string memory userId)", functionName: "joinCampaign" },
		"allow-claim": { address: contractAddress, fn: "function AllowCampaignRewardClaim(string memory userId)", functionName: "AllowCampaignRewardClaim" },
		"allow-mint": { address: NexonsAddress[level!], fn: "function allowUserToMint(string memory userId)", functionName: "allowUserToMint" },
		"allow-ref-reward": {
			address: network === "mainnet" ? "0xa13442fA08Cf107580098d3D1eD858450eeeEeEa" : "0x55F8DbC90946976A234103ed7B7E6e3CeC1A9Af3",
			fn: "function AllowReferralRewardClaim(string memory userId)",
			functionName: "AllowReferralRewardClaim",
		},
	} as Record<string, { address?: string; fn: string; functionName: string }>)[action];
	if (!call) return;

	const nonce = await nextNonce();
	await getWalletClient().writeContract({
		address: call.address as GlobalAddress,
		abi: parseAbi([call.fn]),
		functionName: call.functionName,
		args: [userId],
		account: getAccount(),
		chain,
		nonce,
	} as any);
	lastNonce = { value: nonce, at: Date.now() };
};
