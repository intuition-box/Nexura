import { createWalletClient, parseAbi, http, type WalletClient, type PublicClient, createPublicClient } from "viem";
import { OUTBOUND_TIMEOUT_MS } from "@/utils/resilience";
import { privateKeyToAccount } from "viem/accounts";
import { PRIVATE_KEY, network } from "./env.utils";
import { NexonsAddress, ETH_MAINNET_RPC } from "./constants";
import chain from "./chain.utils";
import { mainnet } from "viem/chains";

let walletClient: WalletClient | undefined = undefined;
let publicClient: PublicClient | undefined = undefined;

const account = privateKeyToAccount(PRIVATE_KEY);

export const serverWalletAddress = account.address;

const getWalletClient = () => {
	if (!walletClient) {
		walletClient = createWalletClient({
			account,
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

export const performIntuitionOnchainAction = async ({
	action,
	contractAddress,
	userId,
	level
}: {
	action: string;
  userId: string;
	level?: string;
	contractAddress?: string;
}) => {
	const walletClient = getWalletClient();

	switch (action) {
		case "join":
			await walletClient.writeContract({
				address: contractAddress as GlobalAddress,
				abi: parseAbi(["function joinCampaign(string memory userId)"]),
				functionName: "joinCampaign",
				args: [userId],
				account,
				chain
			});
			return;
    case "allow-claim":
      await walletClient.writeContract({
				address: contractAddress as GlobalAddress,
				abi: parseAbi([
					"function AllowCampaignRewardClaim(string memory userId)",
				]),
				functionName: "AllowCampaignRewardClaim",
				args: [userId],
				account,
				chain
			});
			return;
		case "allow-mint":
			await walletClient.writeContract({
				address: NexonsAddress[level!]!,
				abi: parseAbi(["function allowUserToMint(string memory userId)"]),
				functionName: "allowUserToMint",
				args: [userId],
				account,
				chain
			});
			return;
		case "allow-ref-reward":
			await walletClient.writeContract({
				address: network === "mainnet" ? "0xa13442fA08Cf107580098d3D1eD858450eeeEeEa" : "0x55F8DbC90946976A234103ed7B7E6e3CeC1A9Af3",
				abi: parseAbi([
					"function AllowReferralRewardClaim(string memory userId)",
				]),
				functionName: "AllowReferralRewardClaim",
				args: [userId],
				account,
				chain
			});
			return;
	}
};
