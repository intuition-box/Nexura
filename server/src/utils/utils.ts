import jwt from "jsonwebtoken";
import { z } from "zod";
import { JWT_SECRET, network, IPAPI_TOKEN, REFRESH_SECRET, STUDIO_FEE_CONTRACT } from "./env.utils";
import { getPublicClient, getEthMainnetClient } from "./account";
import { NexonsAddress, STUDIO_ABI, RELIC_CONTRACT } from "./constants";
import { ethers } from "ethers";
import bcrypt from "bcrypt";
import crypto from "crypto";
import chain from "./chain.utils";
import { checksumAddress, formatEther, parseAbi, type Address } from "viem";
import { announceMilestone } from "./announce";
import { GuildMember } from "discord.js";
import client from "../../client";
import axios from "axios";

export const padNumber = (numberToBePadded: number) => {
	return numberToBePadded.toString().padStart(3, "0");
}

export const getLocation = async (ip: string) => {
	const { data } = await axios.get(
    `https://ipapi.co/${ip}/json?token=${IPAPI_TOKEN}`
  );

  return {
    continent: data.continent_name,
    continentCode: data.continent_code,
    country: data.country_name,
    countryCode: data.country_code,
  }
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

async function updateLevel (data: any) {
	let address: `0x${string}` | undefined = undefined;
	let level: string = "1";
	let milestone = 1000;

	const { xp, badges, level: userLevel } = data;

	try {
		if (xp >= 1000 && xp < 3000) {
			level = "1";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
		} else if (xp >= 3000 && xp < 6000) {
			level = "2";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 3000;
		} else if (xp >= 6000 && xp < 10000) {
			level = "3";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 6000;
		} else if (xp >= 10000 && xp < 15000) {
			level = "4";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 10000;
		} else if (xp >= 15000 && xp < 20000) {
			level = "5";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 15000;
		} else if (xp >= 20000 && xp < 30000) {
			level = "6";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 20000;
		} else if (xp >= 30000 && xp < 40000) {
			level = "7";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 30000;
		} else if (xp >= 40000 && xp < 50000) {
			level = "8";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 40000;
		} else if (xp >= 50000 && xp < 65000) {
			level = "9";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 50000;
		} else if (xp >= 65000 && xp < 75000) {
			level = "10";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 65000;
		} else if (xp >= 75000 && xp < 100000) {
			level = "11";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 75000;
		} else if (xp >= 100000 && xp < 150000) {
			level = "12";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 100000;
		} else if (xp >= 150000 && xp < 200000) {
			level = "13";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 150000;
		} else if (xp >= 200000 && xp < 300000) {
			level = "14";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 200000;
		} else if (xp >= 300000 && xp < 350000) {
			level = "15";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 300000;
		} else if (xp >= 350000 && xp < 400000) {
			level = "16";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 350000;
		} else if (xp >= 400000 && xp < 500000) {
			level = "17";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 400000;
		} else if (xp >= 500000) {
			level = "18";
			if (!badges.includes(parseInt(level))) {
				address = NexonsAddress[level];
			}
			milestone = 500000;
		}

		if (level !== userLevel) { 
			announceMilestone({
				discordId: data.socialProfiles.discord.id,
				id: data._id,
				xp,
				milestone,
				streak: data.streak,
				questsCompleted: data.questsCompleted,
				campaignsCompleted: data.campaignsCompleted,
				lessonsCompleted: data.lessonsCompleted
			});
		}

		return level;
	} catch (error) {
		return level;
	}
}

export { updateLevel };

export async function isMemberOfGuild(guildId: string, userId: string) {
	try {
		const guild = await client.guilds.fetch(guildId);

		const member = await guild.members.fetch(userId);

		return member;
	} catch {
		return false;
	}
}

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

const DISCORD_TASK_TAG_REQUIRES_CHANNEL = new Set([
	"message",
	"message-discord",
	"send-message-discord",
]);
const DISCORD_TASK_TAG_REQUIRES_ROLE = new Set([
	"acquire-role-discord",
]);

/**
 * Validates a single sub-task has the per-tag Discord IDs it needs to be
 * verifiable later. Returns { success: true } for non-Discord tasks, and
 * { success: false, error } with a copy-pasteable message for Discord tasks
 * whose guildId / channelId / roleId is missing. Call this before persisting
 * any discord-tagged miniQuest or campaignQuest so verify-side complaints
 * don't surface as "this quest is missing a discord channel to verify".
 */
export const validateDiscordTaskConfig = (task: Record<string, any>) => {
	const tag = String(task?.tag ?? "").trim().toLowerCase();
	const category = String(task?.category ?? "").trim().toLowerCase();
	const isDiscord =
		["join", "join-discord", "message", "message-discord", "send-message-discord", "acquire-role-discord"].includes(
			tag,
		) || category === "discord";

	if (!isDiscord) return { success: true } as const;

	const guildId = String(task?.guildId ?? "").trim();
	const channelId = String(task?.channelId ?? "").trim();
	const roleId = String(task?.roleId ?? "").trim();

	if (!guildId) {
		return {
			success: false,
			error: `discord task "${tag}" requires guildId. Connect the project's Discord in Studio, then set the channel/role in the task editor.`,
		};
	}
	if (DISCORD_TASK_TAG_REQUIRES_CHANNEL.has(tag) && !channelId) {
		return {
			success: false,
			error: `discord task "${tag}" requires channelId. Set the Discord channel where users must send the message in the task editor (Dashboard or Studio).`,
		};
	}
	if (DISCORD_TASK_TAG_REQUIRES_ROLE.has(tag) && !roleId) {
		return {
			success: false,
			error: `discord task "${tag}" requires roleId. Set the Discord role users must acquire in the task editor (Dashboard or Studio).`,
		};
	}
	return { success: true } as const;
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
		title: z.string().trim(),
		description: z.string().trim(),
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

  const block = await provider.getBlock(tx.blockNumber as number);

  const timestamp = new Date(Number(block!.timestamp) * 1000).toLocaleDateString("en-US", { timeZone: "Africa/Lagos" });

	return { from: tx.from, value: formatEther(tx.value), timestamp };
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

export const getNFT = async (walletAddress: string) => {
  const client = getEthMainnetClient();

	const balance = await client.readContract({
		address: RELIC_CONTRACT,
		abi: parseAbi(["function balanceOf(address owner) view returns (uint256)"]),
		functionName: "balanceOf",
		args: [checksumAddress(walletAddress as `0x${string}`)],
	}) as bigint;

  return balance > 0n;
}
