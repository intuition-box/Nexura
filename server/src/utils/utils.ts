import jwt from "jsonwebtoken";
import { z } from "zod";
import { JWT_SECRET, network, REFRESH_SECRET, STUDIO_FEE_CONTRACT } from "./env.utils";
import { getPublicClient } from "./account";
import { NexonsAddress, STUDIO_ABI } from "./constants";
import { ethers } from "ethers";
import bcrypt from "bcrypt";
import crypto from "crypto";
import chain from "./chain.utils";
import { formatEther } from "viem";

export const padNumber = (numberToBePadded: number) => {
	return numberToBePadded.toString().padStart(3, "0");
}

export const hashPassword = async (password: string) => {
	const salt = await bcrypt.genSalt(12);
	return await bcrypt.hash(password, salt);
}

export const startOfDayUTC = (date = new Date()): Date => {
	return new Date(Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate()
	));
};

async function updateLevel (xp: number, badges: number[], userId: string) {
	let address: `0x${string}` | undefined = undefined;
	let level: string = "1";

	try {
		if (xp >= 1000 && xp < 3000) {
			level = "1";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level]
			}
		} else if (xp >= 3000 && xp < 6000) {
			level = "2";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level]
			}
		} else if (xp >= 6000 && xp < 10000) {
			level = "3";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level]
			}
		} else if (xp >= 10000 && xp < 15000) {
			level = "4";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level]
			}
		} else if (xp >= 15000 && xp < 20000) {
			level = "5";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level]
			}
		} else if (xp >= 20000 && xp < 30000) {
			level = "6";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level]
			}
		} else if (xp >= 30000 && xp < 40000) {
			level = "7";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level]
			}
		} else if (xp >= 40000 && xp < 50000) {
			level = "8";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level]
			}
		} else if (xp >= 50000 && xp < 65000) {
			level = "9";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level]
			}
		} else if (xp >= 65000) {
			level = "10";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level]
			}
		}

		return level;
	} catch (error) {
		return level;
	}
}

export { updateLevel };

export const validateCampaignData = (reqData: any) => {
	const campaignSchema = z.object({
		title: z.string().trim(),
		description: z.string().trim(),
		nameOfProject: z.string().trim(),
		starts_at: z.string().trim(),
		ends_at: z.string().trim(),
		reward: z.object({
			xp: z.number(),
			trust: z.number().optional().default(0),
			pool: z.number()
		}),
		totalTrustAvailable: z.number().optional(),
		campaignQuests: z.array(
			z.object({
				link: z.string().optional(),
				quest: z.string(),
					tag: z.enum([
					"like",
					"follow",
					"follow-x",
					"repost",
					"repost-x",
          "join",
					"feedback",
					"join-discord",
					"message",
					"message-discord",
					"acquire-role-discord",
					"send-message-discord",
					"portal",
					"comment",
					"comment-x",
					"trust-name",
					"create-post",
					"other"
				]),
				category: z.enum(["twitter", "discord", "reddit", "instagram", "facebook", "other"]),
				guildId: z.string().trim().optional(),
				roleId: z.string().trim().optional(),
				channelId: z.string().trim().optional(),
			})
		),
		contractAddress: z.string().optional(),
	});

	const parseData = campaignSchema.safeParse(reqData);

	return parseData;
};

export const validateQuestData = (reqData: any) => {
	const questSchema = z.object({
    title: z.string().trim(),
		page: z.enum(["user", "project"]),
		description: z.string().trim().min(50).max(100),
		xp: z.union([z.string(), z.number()]).optional(),
		reward: z.union([z.string(), z.number()]).optional(),
		campaignQuests: z.array(
      z.object({
        link: z.string().optional(),
        quest: z.string(),
        tag: z.enum([
          "like",
          "follow",
          "follow-x",
          "repost",
          "repost-x",
          "join",
          "join-discord",
          "message",
          "message-discord",
          "feedback",
          "acquire-role-discord",
          "send-message-discord",
          "portal",
          "comment",
          "comment-x",
          "trust-name",
          "create-post",
          "other"
        ]),
      }),
		).optional(),
		category: z.enum(["twitter", "discord", "reddit", "instagram", "facebook", "other"]).optional(),
	});

	const parseData = questSchema.safeParse(reqData);

	return parseData;
};

export const validateMiniQuestData = (reqData: any) => {
	const miniQuestSchema = z.object({
		text: z.string().trim(),
		quest: z.string().trim(),
		link: z.string().trim().optional(),
	});

	const parseData = miniQuestSchema.safeParse(reqData);

	return parseData;
};

export const validateCampaignQuestData = (reqData: any) => {
	const questSchema = z.object({
		title: z.string().trim(),
		description: z.string().trim().min(50).max(100),
		url: z.string().trim().optional(),
		campaign: z.string().trim(),
		reward: z.object({
			xp: z.number(),
		}),
	});

	const parseData = questSchema.safeParse(reqData);

	return parseData;
};

export const validateEcosystemQuestData = (reqData: any) => {
	const ecosystemSchema = z.object({
		title: z.string().trim(),
		description: z.string().trim().min(50).max(100),
		timer: z.string().trim(),
		link: z.string().trim(),
		tags: z.enum([
			"defi",
			"lending-protocols",
			"prediction-markets",
			"nft",
			"social",
			"gaming",
			"portal",
			"domain-name",
			"launchpads",
		]),
		rewards: z.object({
			xp: z.number(),
			trust: z.number(),
		}),
	});

	const parseData = ecosystemSchema.safeParse(reqData);

	return parseData;
};

export const validateHubData = (reqData: any) => {
	const hubSchema = z.object({
		name: z.string().trim(),
    description: z.string().trim().min(150).max(300),
		website: z.string().trim().optional(),
		xAccount: z.string().trim().optional(),
		discordServer: z.string().trim().optional(),
	});

	const parseData = hubSchema.safeParse(reqData);

	return parseData;
};

export const validateUserHubData = (reqData: any) => {
	const useerHubSchema = z.object({
		name: z.string().trim(),
    description: z.string().trim().min(50).max(100),
		website: z.string().trim().optional(),
		xAccount: z.string().trim().optional(),
	});

	const parseData = useerHubSchema.safeParse(reqData);

	return parseData;
};

export const generateOTP = () => {
	const code = crypto
		.randomInt(0, 1000000000)
		.toString()
		.padStart(6, "0")
    .slice(0, 6);

	return code;
};

export const validateSuperAdminData = (reqData: any) => {
	const hubSuperAdminSchema = z.object({
		name: z.string().trim().min(3),
		email: z.email().trim(),
    password: z.string().trim().min(8),
	});

	const parseData = hubSuperAdminSchema.safeParse(reqData);

	return parseData;
};

export const validateHubAdminData = (reqData: any) => {
	const hubAdminSchema = z.object({
		name: z.string().trim().min(3),
		email: z.email().trim(),
    password: z.string().trim().min(8),
		code: z.string().trim().length(6),
	});

	const parseData = hubAdminSchema.safeParse(reqData);

	return parseData;
};

export const validateUserSignUpData = (reqData: any) => {
	const userSchema = z.object({
		username: z.string().trim(),
		email: z.email().trim().optional(),
		// password: z.string().trim(),
	});

	const parseData = userSchema.safeParse(reqData);

	return parseData;
};

export const validateSaveCampaignData = (reqData: any) => {
  const campaignSchema = z.object({
		title: z.string().trim().max(500),
		description: z.string().trim().max(500),
		nameOfProject: z.string().trim(),
    starts_at: z.string().trim(),
		projectCoverImage: z.string().optional(),
		ends_at: z.string().trim(),
		reward: z.object({
			xp: z.number(),
			trust: z.number().optional().default(0),
			pool: z.number()
		}),
		totalTrustAvailable: z.number().optional(),
	});

	const parseData = campaignSchema.safeParse(reqData);

	return parseData;
};

export const validateSaveQuestData = (reqData: any) => {
  const questSchema = z.object({
		title: z.string().trim(),
		description: z.string().trim().max(100),
		nameOfProject: z.string().trim(),
    starts_at: z.string().trim(),
		projectCoverImage: z.string().optional(),
    ends_at: z.string().trim(),
		page: z.enum(["user", "project"]),
	});

	const parseData = questSchema.safeParse(reqData);

	return parseData;
}; 

export const getMissingFields = (error: z.ZodError<Record<any, unknown>>) => {
  const emptyFieldsArray = Object.keys(z.treeifyError(error).properties!);
  const emptyFields = emptyFieldsArray.join(", ");
  return emptyFields;
};

export const JWT = {
  sign: (id: any, expiresInParam?: StringValue) => {
    const expiresIn = expiresInParam ?? "7d";
		return jwt.sign({ id }, JWT_SECRET, { expiresIn });
	},

	verify: (jwtToken: string) => {
		return new Promise((resolve, reject) => {
			jwt.verify(jwtToken, JWT_SECRET, (error, decodedText) => {
				if (error) reject(error.message);
        else if (typeof decodedText === "object") {
					resolve(decodedText);
				} else {
					reject("Invalid JWT payload");
				}
			});
		});
	},
};

export const getRefreshToken = (id: any) => {
	return jwt.sign({ id }, REFRESH_SECRET, { expiresIn: "30d" });
};

export const checkPayment = async (userAddress: string) => {
	const feeContract = STUDIO_FEE_CONTRACT?.trim();

	if (!feeContract) {
		throw new Error(`Studio fee contract is not configured for ${network ?? "the current"} network`);
	}

	if (!ethers.isAddress(feeContract)) {
		throw new Error(`Studio fee contract is invalid: ${feeContract}`);
	}

  const publicClient = getPublicClient();

  const totalCampaigns = await publicClient.readContract({
    abi: STUDIO_ABI,
    address: feeContract as "0x",
    functionName: "getTotalCampaigns",
    args: [userAddress],
  }) as bigint;

	if (totalCampaigns <= 0n) {
		throw new Error("Studio fee payment could not be verified from the transaction receipt");
	}

	return Number(totalCampaigns);
}

export const getAmountPaid = async (txHash: string) => {
	const provider = new ethers.JsonRpcProvider(chain.rpcUrls.default.http[0]);

	const tx = await provider.getTransaction(txHash);
	if (!tx) {
		throw new Error("Transaction not found");
	}

	return { from: tx.from, value: formatEther(tx.value) };
}

export const validateCreateLesson = (reqData: any) => {
	const lessonSchema = z.object({
		title: z.string().trim(),
		description: z.string().trim(),
		reward: z.coerce.number(),
		coverImage: z.string().trim().optional(),
		profileImage: z.string().trim().optional(),
	});

	const parseData = lessonSchema.safeParse(reqData);

	return parseData;
}

export const validateCreateQuestion = (reqData: any) => {
	const questionSchema = z.object({
		question: z.string().trim(),
		options: z.array(z.string()),
		lesson: z.string().trim(),
    solution: z.string().trim(),
	});

	const parseData = questionSchema.safeParse(reqData);

	return parseData;
}

