import { getChain } from "./chain";
import { getWalletClient, getPublicClient } from "./viem";
import { getNetwork } from "./runtimeNetwork";
import { NEXONS, NEXONS_ABI, REWARD_ABI, REWARD_BYTECODE, STREAK_RESTORE_ABI, getStreakRestoreCA } from "./constants";
import { ethers } from "ethers";
import { createPublicClient, http, parseAbi, type Address, parseEther, formatEther } from "viem";
import { getIntuitionNetworkParams } from "./utils";
import { buildUrl } from "./queryClient";
import { toUserFriendlyError } from "./errorMessages";
import { resilientFetch } from "@/lib/resilientFetch";

const STUDIO_FEE_ABI = [
  "function payFee() external payable",
  "error SendTheRequiredFeeAmount(uint fee)",
];

type StudioPaymentConfig = {
  network?: string;
  contractAddress?: string;
  chainId: string;
  amount: string;
  campaignAmount: string;
  authorizedAddress?: string;
};

const getChainIdHex = () => getNetwork() === "mainnet" ? "0x483" : "0x350b";
let readonlyPublicClient: ReturnType<typeof createPublicClient> | undefined;

const requireContractAddress = (address: string | undefined, label: string, networkLabel: string = getNetwork() ?? "the current") => {
  const normalized = address?.trim();

  if (!normalized) {
    throw new Error(`${label} is not configured for ${networkLabel} network.`);
  }

  if (!ethers.isAddress(normalized)) {
    throw new Error(`${label} is invalid: ${normalized}`);
  }

  return normalized;
};

const getReadonlyPublicClient = () => {
  if (!readonlyPublicClient) {
    const chain = getChain();
    readonlyPublicClient = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });
  }

  return readonlyPublicClient;
};

const normalizeUnixTimestamp = (value: number, fieldName: string): number => {
  const normalized = Math.floor(Number(value));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return normalized;
};

const getStudioPaymentConfig = async (): Promise<StudioPaymentConfig> => {
  const response = await resilientFetch(buildUrl("/api/studio-payment-config"));

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    throw new Error(json?.error || "Unable to load studio payment configuration.");
  }

  return response.json();
};

export const getServerAuthorizedAddress = async (): Promise<string> => {
  console.log("[ONCHAIN] getServerAuthorizedAddress");
  const config = await getStudioPaymentConfig();
  return requireContractAddress(config.authorizedAddress, "Server authorized address", config.network ?? "the server");
};

const ensureSwitch = async (targetChainId: string) => {
  // Fast path: switch if chain is already in wallet
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainId }]
    });
    return;
  } catch (err: any) {
    if (err.code === 4001) throw err; // user rejected — bubble up
    // Any other error → try adding the chain
  }

  // Add (+ auto-switch) for wallets that don't know the chain yet
  const params = getIntuitionNetworkParams(false, targetChainId);
  await (window as any).ethereum.request({ method: "wallet_addEthereumChain", params });
};

export const payRestoreStreakFee = async (): Promise<string> => {
  console.log("[ONCHAIN] payRestoreStreakFee");
  try {
    if (!window.ethereum) throw new Error("No wallet provider available. Connect a wallet with RainbowKit first.");

    const config = await getStudioPaymentConfig();

    const targetChainId = config.chainId;
    const amount = config.amount;

    await ensureSwitch(targetChainId);

    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();

    const contract = new ethers.Contract(
      getStreakRestoreCA(),
      STREAK_RESTORE_ABI,
      signer
    );

    const tx = await contract.payFee({ value: parseEther(getNetwork() === "mainnet" ? "1" : "0.01") });

    await tx.wait();

    console.log("[ONCHAIN] payRestoreStreakFee ✓", tx.hash);
    return tx.hash as string;
  } catch (error: any) {
    console.error("[ONCHAIN] payRestoreStreakFee ✗", error);
    if (error.data) {
      const iface = new ethers.Interface(STREAK_RESTORE_ABI);
      const decoded = iface.parseError(error.data);

      throw toUserFriendlyError(decoded?.name ?? error, "Transaction failed.");
    }

    console.error(error);
    throw toUserFriendlyError(error, "Payment failed.");
  }
}

export const payStudioHubFee = async (testAmount?: number, contractAddress?: string, useCampaignAmount?: boolean): Promise<string> => {
  console.log("[ONCHAIN] payStudioHubFee", { testAmount, contractAddress, useCampaignAmount });
  try {
    if (!window.ethereum) throw new Error("No wallet provider available. Connect a wallet with RainbowKit first.");

    const config = await getStudioPaymentConfig();
    const finalContractAddress = requireContractAddress(
      contractAddress || config.contractAddress,
      "Studio fee contract",
      config.network ?? "the server"
    );
    const targetChainId = config.chainId;
    const amount = useCampaignAmount ? config.campaignAmount : config.amount;

    await ensureSwitch(targetChainId);

    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();

    const contract = new ethers.Contract(
      finalContractAddress,
      STUDIO_FEE_ABI,
      signer
    );

    const tx = await contract.payFee({ value: parseEther(testAmount?.toString() ?? amount) });

    await tx.wait();

    console.log("[ONCHAIN] payStudioHubFee ✓", tx.hash);
    return tx.hash as string;
  } catch (error: any) {
    console.error("[ONCHAIN] payStudioHubFee ✗", error);
    if (error.data) {
      const iface = new ethers.Interface(STUDIO_FEE_ABI);
      const decoded = iface.parseError(error.data);

      throw toUserFriendlyError(decoded?.name ?? error, "Transaction failed.");
    }

    console.error(error);
    throw toUserFriendlyError(error, "Payment failed.");
  }
};

interface IrewardContract {
  nameOfCampaign: string;
  totalRewards: number | string;
  rewardToken: number | string;
  startDate: number;
}

const toWeiAmount = (amount: number | string, fieldName: string): bigint => {
  const normalized = typeof amount === "number" ? amount.toString() : amount.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`);
  }

  return parseEther(normalized);
};

export const createRewardsContract = async ({ nameOfCampaign, totalRewards, rewardToken, startDate }: IrewardContract) => {
  console.log("[ONCHAIN] createRewardsContract", { nameOfCampaign, totalRewards, rewardToken, startDate });
  try {
    const walletClient = await getWalletClient();
    const publicClient = getPublicClient();
    if (!walletClient) throw new Error("No wallet provider available. Connect a wallet with RainbowKit first.");

    await ensureSwitch(getChainIdHex());

    const authorizedAddress = await getServerAuthorizedAddress();

    const totalRewardsWei = toWeiAmount(totalRewards, "Total rewards");
    const rewardTokenWei = toWeiAmount(rewardToken, "Reward per participant");

    const [account] = await walletClient.getAddresses();
    const walletBalance = await publicClient.getBalance({ address: account as Address });

    if (walletBalance < totalRewardsWei) {
      throw new Error(
        `Insufficient TRUST balance. Required: ${formatEther(totalRewardsWei)} TRUST, available: ${formatEther(walletBalance)} TRUST.`
      );
    }

    const hash = await walletClient.deployContract({
      abi: REWARD_ABI,
      bytecode: REWARD_BYTECODE,
      args: [nameOfCampaign, totalRewardsWei, rewardTokenWei, authorizedAddress, startDate],
      account,
      chain: getChain(),
      value: totalRewardsWei
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) {
      throw new Error("Unable to determine deployed contract address.");
    }
    const tx = await publicClient.getTransaction({ hash });
    if (tx.value !== totalRewardsWei) {
      throw new Error("Contract deployment did not fund the exact reward pool amount.");
    }

    const onchainTotalReward = await publicClient.readContract({
      address: receipt.contractAddress,
      abi: REWARD_ABI,
      functionName: "totalReward",
    }) as bigint;
    const onchainRewardToken = await publicClient.readContract({
      address: receipt.contractAddress,
      abi: REWARD_ABI,
      functionName: "rewardToken",
    }) as bigint;
    if (onchainTotalReward !== totalRewardsWei || onchainRewardToken !== rewardTokenWei) {
      throw new Error("Deployed rewards contract configuration does not match the requested reward pool.");
    }
    const maxClaimableParticipants = onchainRewardToken > 0n
      ? (onchainTotalReward / onchainRewardToken).toString()
      : "0";

    console.log("[ONCHAIN] createRewardsContract ✓", {
      txHash: receipt.transactionHash,
      contractAddress: receipt.contractAddress,
      authorizedAddress,
      fundedAmount: formatEther(tx.value),
      rewardPerParticipant: formatEther(rewardTokenWei),
      maxClaimableParticipants,
    });
    return {
      txHash: receipt.transactionHash,
      contractAddress: receipt.contractAddress,
      authorizedAddress,
      fundedAmount: formatEther(tx.value),
      rewardPerParticipant: formatEther(rewardTokenWei),
      maxClaimableParticipants,
    };
  } catch (error: any) {
    console.error("[ONCHAIN] createRewardsContract ✗", error);
    if (error.data) {
      const iface = new ethers.Interface(REWARD_ABI);
      const decoded = iface.parseError(error.data);

      throw toUserFriendlyError(decoded?.name ?? error, "Failed to deploy rewards contract.");
    }

    console.error(error);
    throw toUserFriendlyError(error, "Failed to deploy rewards contract.");
  }
}

export const addReward = async (contractAddress: string, rewardsToAdd: number | string): Promise<string> => {
  console.log("[ONCHAIN] addReward", { contractAddress, rewardsToAdd });
  try {
    const walletClient = await getWalletClient();
    const publicClient = getPublicClient();
    if (!walletClient) throw new Error("No wallet provider available. Connect a wallet with RainbowKit first.");

    await ensureSwitch(getChainIdHex());

    const [account] = await walletClient.getAddresses();

    const rewardsToAddWei = toWeiAmount(rewardsToAdd, "Reward to add");

    const { request } = await publicClient.simulateContract({
      abi: REWARD_ABI,
      address: contractAddress as "0x",
      functionName: "addReward",
      args: [rewardsToAddWei],
      chain: getChain(),
      account,
      value: rewardsToAddWei
    });

    const hash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("[ONCHAIN] addReward ✓", hash);
    return hash;
  } catch (error: any) {
    console.error("[ONCHAIN] addReward ✗", error);
    if (error.data) {
      const iface = new ethers.Interface(REWARD_ABI);
      const decoded = iface.parseError(error.data);

      throw toUserFriendlyError(decoded?.name ?? error, "Failed to add reward.");
    }

    console.error(error);
    throw toUserFriendlyError(error, "Failed to add reward.");
  }
}

export const getRewardContractBalance = async (contractAddress: string): Promise<bigint> => {
  console.log("[ONCHAIN] getRewardContractBalance", { contractAddress });
  const validatedCampaignAddress = requireContractAddress(contractAddress, "Campaign contract");
  const publicClient = getReadonlyPublicClient();

  return publicClient.getBalance({ address: validatedCampaignAddress as Address });
};

export const getRewardContractStartDate = async (contractAddress: string): Promise<number> => {
  console.log("[ONCHAIN] getRewardContractStartDate", { contractAddress });
  const validatedCampaignAddress = requireContractAddress(contractAddress, "Campaign contract");
  const publicClient = getReadonlyPublicClient();

  const startDate = await publicClient.readContract({
    abi: REWARD_ABI,
    address: validatedCampaignAddress as Address,
    functionName: "startDate",
  }) as bigint;

  return Number(startDate);
};

export const getRewardCampaignCreator = async (contractAddress: string): Promise<string> => {
  console.log("[ONCHAIN] getRewardCampaignCreator", { contractAddress });
  const validatedCampaignAddress = requireContractAddress(contractAddress, "Campaign contract");
  const publicClient = getReadonlyPublicClient();

  const creator = await publicClient.readContract({
    abi: REWARD_ABI,
    address: validatedCampaignAddress as Address,
    functionName: "campaignCreator",
  }) as Address;

  return String(creator);
};

export const updateRewardStartTime = async (contractAddress: string, newDate: number): Promise<string> => {
  console.log("[ONCHAIN] updateRewardStartTime", { contractAddress, newDate });
  try {
    const walletClient = await getWalletClient();
    const publicClient = getPublicClient();
    if (!walletClient) throw new Error("No wallet provider available. Connect a wallet with RainbowKit first.");

    await ensureSwitch(getChainIdHex());

    const [account] = await walletClient.getAddresses();
    const validatedCampaignAddress = requireContractAddress(contractAddress, "Campaign contract");
    const normalizedDate = normalizeUnixTimestamp(newDate, "Campaign start date");

    const { request } = await publicClient.simulateContract({
      abi: REWARD_ABI,
      address: validatedCampaignAddress as Address,
      functionName: "updateDate",
      args: [normalizedDate],
      chain: getChain(),
      account,
    });

    const hash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("[ONCHAIN] updateRewardStartTime ✓", hash);
    return hash;
  } catch (error: any) {
    console.error("[ONCHAIN] updateRewardStartTime ✗", error);
    if (error.code === 4902) {
      throw new Error("Please switch to the required network and try again.");
    }

    if (error.data) {
      const iface = new ethers.Interface(REWARD_ABI);
      const decoded = iface.parseError(error.data);

      throw toUserFriendlyError(decoded?.name ?? error, "Failed to update reward start time.");
    }

    console.error(error);
    throw toUserFriendlyError(error, "Failed to update reward start time.");
  }
}

export const syncRewardContractStartDate = async (contractAddress: string, newDate: number) => {
  console.log("[ONCHAIN] syncRewardContractStartDate", { contractAddress, newDate });
  const normalizedDate = normalizeUnixTimestamp(newDate, "Campaign start date");
  const currentStartDate = await getRewardContractStartDate(contractAddress);

  if (normalizedDate <= currentStartDate) {
    console.log("[ONCHAIN] syncRewardContractStartDate ✓", {
      updated: false,
      currentStartDate,
      nextStartDate: normalizedDate,
      txHash: null,
    });
    return {
      updated: false,
      currentStartDate,
      nextStartDate: normalizedDate,
      txHash: null,
    };
  }

  const txHash = await updateRewardStartTime(contractAddress, normalizedDate);

  console.log("[ONCHAIN] syncRewardContractStartDate ✓", {
    updated: true,
    currentStartDate,
    nextStartDate: normalizedDate,
    txHash,
  });
  return {
    updated: true,
    currentStartDate,
    nextStartDate: normalizedDate,
    txHash,
  };
};

export const closeRewardCampaign = async (contractAddress: string): Promise<string> => {
  console.log("[ONCHAIN] closeRewardCampaign", { contractAddress });
  try {
    const walletClient = await getWalletClient();
    const publicClient = getReadonlyPublicClient();
    if (!walletClient) throw new Error("No wallet provider available. Connect a wallet with RainbowKit first.");

    await ensureSwitch(getChainIdHex());

    const [account] = await walletClient.getAddresses();
    const validatedCampaignAddress = requireContractAddress(contractAddress, "Campaign contract");

    const { request } = await publicClient.simulateContract({
      abi: REWARD_ABI,
      address: validatedCampaignAddress as Address,
      functionName: "closeCampaign",
      chain: getChain(),
      account,
    });

    const hash = await walletClient.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("[ONCHAIN] closeRewardCampaign ✓", hash);
    return hash;
  } catch (error: any) {
    console.error("[ONCHAIN] closeRewardCampaign ✗", error);
    if (error.code === 4902) {
      throw new Error("Please switch to the required network and try again.");
    }

    if (error.data) {
      const iface = new ethers.Interface(REWARD_ABI);
      const decoded = iface.parseError(error.data);

      throw toUserFriendlyError(decoded?.name ?? error, "Failed to withdraw remaining rewards.");
    }

    console.error(error);
    throw toUserFriendlyError(error, "Failed to withdraw remaining rewards.");
  }
};

export const claimCampaignOnchainReward = async ({ campaignAddress, userId }: { campaignAddress: string, userId: string }) => {
  console.log("[ONCHAIN] claimCampaignOnchainReward", { campaignAddress, userId });
  try {
    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error("No wallet provider available. Connect a wallet with RainbowKit first.");
    const validatedCampaignAddress = requireContractAddress(campaignAddress, "Campaign contract");

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: getChainIdHex() }]
    });

    const provider = new ethers.BrowserProvider((window as any).ethereum);

    const signer = await provider.getSigner();

    const contract = new ethers.Contract(
      validatedCampaignAddress,
      REWARD_ABI,
      signer
    );

    const tx = await contract.claimReward(userId);

    await tx.wait();

    console.log("[ONCHAIN] claimCampaignOnchainReward ✓", tx.hash);
    return tx.hash;
  } catch (error: any) {
    console.error("[ONCHAIN] claimCampaignOnchainReward ✗", error);
    if (error.code === 4902) {
      throw new Error("Please switch to the required network and try again.")
    }

    if (error.data) {
      const iface = new ethers.Interface(REWARD_ABI);
      const decoded = iface.parseError(error.data);

      throw toUserFriendlyError(decoded?.name ?? error, "Unable to claim rewards.");
    }

    console.error(error);
    throw toUserFriendlyError(error, "Unable to claim rewards.");
  }
}

export const claimReferralReward = async (userId: string) => {
  console.log("[ONCHAIN] claimReferralReward", { userId });
  try {
    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error("No wallet provider available. Connect a wallet with RainbowKit first.");

    const mainnet = getNetwork() === "mainnet";

    await walletClient.switchChain({ id: mainnet ? 1155 : 13579 });

    const account = await walletClient.getAddresses();

    await walletClient.writeContract({
      address: (mainnet ? "0xa13442fA08Cf107580098d3D1eD858450eeeEeEa" : "0x55F8DbC90946976A234103ed7B7E6e3CeC1A9Af3") as Address,
      abi: parseAbi(["function claimReferralReward(string memory userId)"]),
      functionName: "claimReferralReward",
      args: [userId],
      account: account[0],
      chain: getChain()
    });

    console.log("[ONCHAIN] claimReferralReward ✓", { userId });
  } catch (error: any) {
    console.error("[ONCHAIN] claimReferralReward ✗", error);
    console.error(error);
    throw toUserFriendlyError(error, "Unable to claim referral reward.");
  }
}

export const mintNexon = async (level: number, userId: string) => {
  console.log("[ONCHAIN] mintNexon", { level, userId });
  try {
    const walletClient = await getWalletClient();
    if (!walletClient) throw new Error("No wallet provider available. Connect a wallet with RainbowKit first.");

    const mainnet = getNetwork() === "mainnet";

    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: mainnet ? "0x483" : "0x350b" }]
    });

    const { address, metadata } = NEXONS[level];

    const provider = new ethers.BrowserProvider((window as any).ethereum);

    const signer = await provider.getSigner();

    const contract = new ethers.Contract(
      address,
      NEXONS_ABI,
      signer
    );

    const tx = await contract.mint(
      metadata,
      userId,
      level > 2 ? { value: ethers.parseEther("1") } : {}
    );

    await tx.wait();

    console.log("[ONCHAIN] mintNexon ✓", tx.hash);
    return tx.hash;
  } catch (error: any) {
    console.error("[ONCHAIN] mintNexon ✗", error);
    if (error.code === 4902) {
      throw new Error("Please switch to the required network and try again.")
    }

    if (error.data) {
      const iface = new ethers.Interface(NEXONS_ABI);
      const decoded = iface.parseError(error.data);

      throw toUserFriendlyError(decoded?.name ?? error, "Unable to mint badge.");
    }

    console.error(error);
    throw toUserFriendlyError(error, "Unable to mint badge.");
  }
};
