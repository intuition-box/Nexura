import logger from "@/config/logger";
import { campaign, campaignCompleted } from "@/models/campaign.model";
import { campaignQuest, ecosystemQuest, miniQuest, quest } from "@/models/quests.model";
import {
	campaignQuestCompleted,
	ecosystemQuestCompleted,
	miniQuestCompleted,
	questCompleted,
} from "@/models/questsCompleted.models";
import { user } from "@/models/user.model";
import { submission } from "@/models/submission.model";
import { referredUsers } from "@/models/referrer.model";
import { performIntuitionOnchainAction } from "@/utils/account";
import {
	INTERNAL_SERVER_ERROR,
	OK,
	BAD_REQUEST,
	FORBIDDEN,
	NOT_FOUND,
  CREATED,
	NO_CONTENT
} from "@/utils/status.utils";
import {
	validateCampaignQuestData,
	padNumber,
	validateEcosystemQuestData,
	validateMiniQuestData,
	updateLevel,
  validateQuestData,
  getMissingFields,
  validateSaveQuestData
} from "@/utils/utils";
import mongoose from "mongoose";
import { hub, userHub } from "@/models/hub.model";
import { uploadImg } from "@/utils/img.utils";
import { parseDate, normalizeCampaignDateInput } from "@/utils/dates";
import { xpLog } from "@/models/xpLog.model";
import { consumePaymentHash } from "./studioPayment.controller";
import { environment } from "@/utils/env.utils";

const DISCORD_CAMPAIGN_TAGS = new Set([
	"join",
	"message",
	"join-discord",
	"message-discord",
	"acquire-role-discord",
	"send-message-discord",
]);

const PROOF_REQUIRED_CAMPAIGN_TAGS = new Set([
	"comment",
	"comment-x",
	"follow",
	"follow-x",
	"repost-x",
	"feedback",
	"create-post",
]);

// todo: add ecosystem completed to eco quests
export const fetchEcosystemDapps = async (
	req: GlobalRequest,
	res: GlobalResponse
) => {
	try {
		const ecosystemQuests = await ecosystemQuest.find().lean();
		const ecosystemQuestsCompleted = await ecosystemQuestCompleted.find({
			user: req.id,
		}).lean();

		const mergedEcosystemQuests: any[] = [];

		for (const ecoQuest of ecosystemQuests) {
			const ecoQuestCompleted = ecosystemQuestsCompleted.find(
				(completedEcoQuest) =>
					completedEcoQuest.ecosystemQuest?.toString() === ecoQuest._id.toString()
			);

			const mergedEcoQuest: Record<any, unknown> = ecoQuest;

			mergedEcoQuest.done = ecoQuestCompleted ? ecoQuestCompleted.done : false;

			mergedEcosystemQuests.push(mergedEcoQuest);
		}

		res.status(OK).json({ message: "quests fetched!", ecosystemQuests: mergedEcosystemQuests });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching quests" });
	}
};

export const fetchQuests = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const Hub = (await import('../models/hub.model')).hub;

		const questsInDB = await quest.find({ status: { $ne: "Save" } }).lean();
		const completedQuests = await questCompleted.find({
			user: new mongoose.Types.ObjectId(req.id),
		}).lean().select("_id done");

		const quests: any[] = [];

		for (const singleQuest of questsInDB) {
			const singleQuestCompleted = completedQuests.find(
			(completedQuest) => completedQuest.quest?.toString() === singleQuest._id.toString()
			);

			const mergedQuest: Record<any, unknown> = singleQuest;

			mergedQuest.done = singleQuestCompleted ? singleQuestCompleted.done : false;
			mergedQuest.joined = !!singleQuestCompleted;

			const temporalStatus = getTemporalQuestStatus(singleQuest);
			if (temporalStatus && temporalStatus !== singleQuest.status && singleQuest.status !== "Save" && singleQuest.status !== "Ended") {
				mergedQuest.status = temporalStatus;
				(mergedQuest as any)._needsStatusUpdate = temporalStatus;
			}

			// Set project_name and project_image based on hub
			if (singleQuest.hub) {
				const hub = await Hub.findById(singleQuest.hub).select('name logo systemKey').lean();
				if (hub) {
					// If it's a system hub (Nexura), show "Nexura" as creator
					if (hub.systemKey === 'nexura-admin-campaigns') {
						mergedQuest.project_name = 'Nexura';
					} else {
						mergedQuest.project_name = hub.name;
					}
					mergedQuest.project_image = hub.logo;
				}
			}

			quests.push(mergedQuest);
		}

		// Persist updated statuses
		const statusUpdates = quests.filter((q: any) => q._needsStatusUpdate).map((q: any) => ({ _id: q._id, status: q._needsStatusUpdate }));
		if (statusUpdates.length > 0) {
			await quest.bulkWrite(
				statusUpdates.map(({ _id, status }) => ({
					updateOne: { filter: { _id }, update: { $set: { status } } },
				}))
			);
		}

		res
			.status(OK)
			.json({ message: "quests fetched!", quests });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching quests" });
	}
};

export const fetchMiniQuests = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
		if (!id) {
			res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
			return;
		}

		const mainQuest = await quest.findById(id).lean();
		if (!mainQuest) {
			res.status(BAD_REQUEST).json({ error: "quest doesn't exist or in invalid" });
			return;
		}

		const miniQuestsInDB = await miniQuest.find({ quest: id }).lean();

		const miniQuestsCompleted = await miniQuestCompleted.find({
			quest: id,
			user: req.id,
		});

		const miniQuests: any[] = [];

		for (const miniquest of miniQuestsInDB) {
			const miniquestCompleted = miniQuestsCompleted.find(
				(completedQuest) => completedQuest.miniQuest?.toString() === miniquest._id.toString()
			);

			const mergedQuest: Record<any, unknown> = miniquest;

			mergedQuest.done = miniquestCompleted ? miniquestCompleted.done : false;
			mergedQuest.status = miniquestCompleted ? miniquestCompleted.status : "";

			miniQuests.push(mergedQuest);
		}

		const mainQuestCompleted = await questCompleted.findOne({ user: req.id, quest: id });

		let currentHub: any;

		if (mainQuest.creatorModel === "admin") {
			currentHub = await hub.findById(mainQuest.hub).lean();
		} else {
			currentHub = await userHub.findById(mainQuest.hub).lean();
		}

		const hubInfo = {
			id: currentHub?._id?.toString?.() ?? "",
			name: currentHub?.name ?? mainQuest.project_name ?? "",
			description: currentHub?.description ?? "",
			logo: currentHub?.logo ?? mainQuest.project_image ?? "",
			website: (currentHub as any)?.website ?? "",
			xAccount: (currentHub as any)?.xAccount ?? "",
			discordServer: (currentHub as any)?.discordServer ?? "",
		};

		const questNumber = padNumber(mainQuest.questNumber!);

		res.status(OK).json({ 
			message: "mini quests fetched", 
			miniQuests, 
			questCompleted: mainQuestCompleted?.done, 
			totalXp: mainQuest.reward, 
			questNumber, 
			sub_title: mainQuest?.sub_title, 
			title: mainQuest.title, 
			description: mainQuest.description,
			hubInfo,
			projectCoverImage: mainQuest.projectCoverImage,
			hub: mainQuest.hub,
		});
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching mini quests" });
	}
};

export const startQuest = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
		if (!id) {
			res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
			return;
    }

    const questExists = await quest.findById(id);
    if (!questExists) {
      res.status(NOT_FOUND).json({ error: "quest does not exist or id is invalid" });
      return;
    }

		const questStarted = await questCompleted.exists({ quest: id, user: req.id });
		if (questStarted) {
			res.status(OK).json({ message: "quest already started" });
			return;
    }

    questExists.participants += 1;

    await Promise.all([
      questCompleted.create({ quest: id, user: req.id, done: false }),
      questExists.save()
    ]);

		res.status(OK).json({ message: "quest started" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error starting quest" });
	}
}

export const fetchCampaignQuests = async (
	req: GlobalRequest,
	res: GlobalResponse
) => {
	try {
		const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
		if (!id) {
			res.status(BAD_REQUEST).json({ error: "Campaign ID is required" });
			return;
		}
		const userId = req.id!;

		const currentCampaign = await campaign.findById(id).lean();
		if (!currentCampaign) {
			res
				.status(NOT_FOUND)
				.json({ error: "id associated with campaign is invalid" });
			return;
		}

		const currentHub = await hub.findById(currentCampaign.hub).lean();
		const hubInfo = {
			id: currentHub?._id?.toString?.() ?? "",
			name: currentHub?.name ?? currentCampaign.project_name ?? "",
			description: currentHub?.description ?? "",
			logo: currentHub?.logo ?? currentCampaign.project_image ?? "",
			website: currentHub?.website ?? "",
			xAccount: currentHub?.xAccount ?? "",
			discordServer: currentHub?.discordServer ?? "",
		};

		const quests = await campaignQuest.find({ campaign: id }).lean();

		const campaignQuestsCompleted = await campaignQuestCompleted.find({
			user: userId,
			campaign: id,
		}).lean();

		const completedCampaign = await campaignCompleted.findOne({
			user: userId,
			campaign: id,
		});

		const campaignQuests: any[] = [];

		for (const campaign_quest of quests) {
			const campaign_questCompleted = campaignQuestsCompleted.find(
				(completedCampaignQuest) =>
					completedCampaignQuest.campaignQuest?.toString() === campaign_quest._id.toString()
			);

			const mergedCampaignQuest: Record<any, unknown> = campaign_quest;

			mergedCampaignQuest.done = campaign_questCompleted ? campaign_questCompleted.done : false;
			mergedCampaignQuest.status = campaign_questCompleted ? campaign_questCompleted.status : "";

			campaignQuests.push(mergedCampaignQuest);
		}

		const joined = completedCampaign ? true : false;

		const campaignQuestsMarkedAsDone = campaignQuestsCompleted.filter((c_q: { done: boolean }) => c_q.done === true);

		if (currentCampaign.noOfQuests === campaignQuestsMarkedAsDone.length && completedCampaign && !completedCampaign.questsCompleted) {
			if (currentCampaign.trustClaimed < currentCampaign.totalTrustAvailable && currentCampaign.contractAddress) {
				await performIntuitionOnchainAction({
					action: "allow-claim",
					userId,
					contractAddress: currentCampaign.contractAddress,
				});
			}

			completedCampaign.questsCompleted = true;
			await completedCampaign.save();
		}

		const campaignNumber = padNumber(currentCampaign.campaignNumber);

		res.status(OK).json({
			message: "quests fetched!",
			campaignQuests,
			campaignCompleted: completedCampaign,
			hub: currentCampaign.hub,
			description: currentCampaign.description,
			address: currentCampaign?.contractAddress,
			title: currentCampaign.title,
			trustClaimed: currentCampaign.trustClaimed,
			reward: currentCampaign.reward,
			totalTrustAvailable: currentCampaign.totalTrustAvailable,
			maxParticipants: (currentCampaign as any).maxParticipants ?? currentCampaign.participants,
			project_name: currentCampaign.project_name,
			project_image: currentCampaign.project_image,
			hubDescription: currentHub?.description ?? "",
			hubInfo,
			sub_title: currentCampaign.sub_title,
			projectCoverImage: currentCampaign.projectCoverImage,
			joined,
			campaignNumber,
		});
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "error fetching quests for campaign" });
	}
};

export const createCampaignQuests = async (
	req: GlobalRequest,
	res: GlobalResponse
) => {
	try {
		const { success } = validateCampaignQuestData(req.body);
		if (!success) {
			res.status(BAD_REQUEST).json({
				error: "send the correct data required to create a campaign quest",
			});
			return;
		}

		const campaignToUpdate = await campaign.findById(req.body.campaign);
		if (!campaignToUpdate) {
			res
				.status(BAD_REQUEST)
				.json({ error: "id associated with campaign is invalid" });
			return;
		}

		await campaignQuest.create(req.body);

		campaignToUpdate.noOfQuests += 1;
		await campaignToUpdate.save();

		res.status(CREATED).json({ message: "campaign quest created!" });
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "error creating campaign quest" });
	}
};

export const createMiniQuest = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { success } = validateMiniQuestData(req.body);
		if (!success) {
			res.status(BAD_REQUEST).json({ error: "send the data required to create a mini quest" });
			return;
		}

		await miniQuest.create(req.body);

		res.status(CREATED).json({ message: "mini quest created" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error creating mini quest" });
	}
};

// todo: link ecosystem quest to hub
export const createEcosystemQuests = async (
	req: GlobalRequest,
	res: GlobalResponse
) => {
	try {
		const { success } = validateEcosystemQuestData(req.body);
		if (!success) {
			res.status(BAD_REQUEST).json({
				error: "send the correct data required to create an ecosystem quest",
			});
			return;
		}

		await ecosystemQuest.create(req.body);

		res.status(CREATED).json({ message: "campaign quest created!" });
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "error creating ecosystem quest" });
	}
};

export const performCampaignQuest = async (
	req: GlobalRequest,
	res: GlobalResponse
) => {
	try {
		const { id, campaignId } = req.body;

		const campaignQuestk = await campaignQuest.findById(id).lean();
		if (!campaignQuestk) {
			res
				.status(NOT_FOUND)
				.json({ error: "id associated with campaign quest is invalid" });
			return;
		}

		const normalizedTag = String(campaignQuestk.tag ?? "").trim().toLowerCase();
		const isDiscordQuest = DISCORD_CAMPAIGN_TAGS.has(normalizedTag);
		const requiresProof = PROOF_REQUIRED_CAMPAIGN_TAGS.has(normalizedTag);
		const normalizedCampaignId = String(campaignId ?? campaignQuestk.campaign ?? "").trim();

		let campaignDone = await campaignQuestCompleted.findOne({
			user: req.id,
			campaignQuest: id,
		});

		const failDiscordCompletion = async (errorMessage: string) => {
			if (campaignDone && campaignDone.done !== true) {
				campaignDone.status = "retry";
				await campaignDone.save();
			}

			res.status(FORBIDDEN).json({ error: errorMessage });
		};

		if (isDiscordQuest) {
			if (!normalizedCampaignId) {
				res.status(BAD_REQUEST).json({ error: "campaign id is required for discord task completion" });
				return;
			}

			const relatedCampaign = await campaign.findById(normalizedCampaignId).select("hub").lean();
			if (!relatedCampaign?.hub) {
				res.status(NOT_FOUND).json({ error: "campaign project not found for this discord task" });
				return;
			}

			const studioHub = await hub.findById(relatedCampaign.hub).select("discordConnected guildId").lean();
			const studioGuildId = String(studioHub?.guildId ?? "").trim();
			const questGuildId = String(campaignQuestk.guildId ?? "").trim();

			if (!studioHub?.discordConnected || !studioGuildId) {
				await failDiscordCompletion(
					"this project's Discord connection is not active in Studio. The campaign team needs to reconnect Discord before Discord tasks can be completed."
				);
				return;
			}

			if (questGuildId && studioGuildId !== questGuildId) {
				await failDiscordCompletion(
					"this campaign's Discord setup no longer matches the project's active Studio Discord connection."
				);
				return;
			}
		}

		if (!campaignDone) {
			if (isDiscordQuest) {
				res.status(FORBIDDEN).json({ error: "discord tasks must be verified before they can be completed" });
				return;
			}

			if (requiresProof) {
				res.status(FORBIDDEN).json({ error: "this task requires a submission for review before it can be completed" });
				return;
			}

			// Auto-create completion record for tasks that skip the submit step
			// (e.g. X follow/comment where verification is deferred)
			campaignDone = await campaignQuestCompleted.create({
				campaign: normalizedCampaignId,
				campaignQuest: id,
				user: req.id,
				done: true,
				status: "done",
			});
			res.status(OK).json({ message: "quest done" });
			return;
		}

		if (campaignDone.status !== "pending") {
			res.status(BAD_REQUEST).json({ error: "quest needs to be marked as pending before it can be claimed" });
			return;
		}

		if (campaignDone.done === true) {
			res.status(FORBIDDEN).json({ error: "campaign quest already claimed" });
			return;
		}

		campaignDone.done = true;
		campaignDone.status = "done";

		await campaignDone.save();

		res.status(OK).json({ message: "quest done" });

		// if (!campaignDone) {
		// 	res.status(FORBIDDEN).json({ message: "submit campaign task to proceed" });
		// 	return;
		// }

		// if (campaignDone.status !== "done") {
		// 	res
		// 		.status(FORBIDDEN)
		// 		.json({ error: "task not performed" });
		// 	return;
		// }

		// if (campaignDone.done) {
		// 	res
		// 		.status(FORBIDDEN)
		// 		.json({ error: "already performed campaign task" });
		// 	return;
		// }

		// campaignDone.done = true;
		// await campaignDone.save();

		// res.status(OK).json({ message: "campaign task done" });
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "error performing campaign quest" });
	}
};

export const claimMiniQuest = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const { questId, id } = req.body;

		const mini_quest = await miniQuest.findById(id).lean();
		if (!mini_quest) {
			res.status(NOT_FOUND).json({ error: "mini quest id is invalid" });
			return;
		}

		const mainQuest = await quest.findById(questId).lean();
		if (!mainQuest) {
			res.status(NOT_FOUND).json({ error: "quest is invalid/doesn't exist" });
			return;
		}

		const claimer = await user.findById(req.id).lean();
		if (!claimer) {
			res.status(NOT_FOUND).json({ error: "invalid user or user dos not exist" });
			return;
		}

		const miniQuestExists = await miniQuestCompleted.findOne({ miniQuest: id, user: req.id });
		if (!miniQuestExists) {
			res.status(NOT_FOUND).json({ error: "mini quest has not been validated" });
			return
		}

		if (miniQuestExists.done === true) {
			res.status(FORBIDDEN).json({ error: "quest already claimed" });
			return;
		}

		if (miniQuestExists.status !== "done" && miniQuestExists.status !== "pending") {
			res.status(BAD_REQUEST).json({ error: "quest needs to be marked as pending before it can be caimed" });
			return;
		}

		miniQuestExists.done = true;
		miniQuestExists.status = "done";

		res.status(OK).json({ message: "quest done" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error claiming mini quest" });
	}
};

export const claimQuest = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
		if (!id) {
			res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
			return;
		}

		const questFound = await quest.findById(id).lean();
		if (!questFound) {
			res
				.status(NOT_FOUND)
				.json({ error: "id associated with quest is invalid" });
			return;
		}

		const questUser = await user.findById(req.id);
		if (!questUser) {
			res.status(NOT_FOUND).json({ error: "invalid user" });
			return;
		}

		const isQuestCompleted = await questCompleted.findOne({ quest: id, user: questUser._id }).lean();
		if (!isQuestCompleted) {
			res.status(FORBIDDEN).json({ error: "quest has not been started" });
			return;
		}

		if (isQuestCompleted.done) {
			res.status(FORBIDDEN).json({ error: "quest already claimed" });
			return;
		}

		questUser.questsCompleted += 1;

		questUser.xp += questFound.reward;

		await questCompleted.updateOne({ quest: id, user: questUser._id }, { expires: new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000), done: true });

		if (questUser.status !== "Active") {
			questUser.status = "Active";

			const userReferred = await referredUsers.findOne({ newUser: questUser._id });
			if (userReferred && userReferred.status !== "Active") {
				userReferred.status = "Active";

				await userReferred.save();
			}
		}

		const level = await updateLevel(questUser.xp, questUser.badges, questUser._id.toString());

		questUser.level = level;

		await xpLog.create({
			address: questUser.address,
      amount: questFound.reward,
			username: questUser.username,
			status: "success",
			type: "quest"
    });

		await questUser.save();

		res.status(OK).json({ message: "quest done!" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error claiming quest" });
	}
};

export const claimEcosystemQuest = async (
	req: GlobalRequest,
	res: GlobalResponse
) => {
	try {
		const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
		if (!id) {
			res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
			return;
		}

		const userId = req.id;

		const ecosystemQuestUser = await user.findById(userId);
		if (!ecosystemQuestUser) {
			res
				.status(NOT_FOUND)
				.json({ error: "id associated with user is invalid" });
			return;
		}

		const ecosystemQuestFound = await ecosystemQuest.findById(id).lean();
		if (!ecosystemQuestFound) {
			res
				.status(NOT_FOUND)
				.json({ error: "id associated with ecosystem quest is invalid" });
			return;
		}

		let ecosystemQuestToClaim = await ecosystemQuestCompleted.findOne({
			user: userId,
			ecosystemQuest: id,
		});

		if (ecosystemQuestToClaim?.done) {
			res
				.status(FORBIDDEN)
				.json({ error: "ecosystem quest has been completed" });
			return;
		}

		if (!ecosystemQuestToClaim) {
			ecosystemQuestToClaim = await ecosystemQuestCompleted.create({
				done: false,
				timer: new Date(),
				ecosystemQuest: id,
				user: userId,
			});
		}

		ecosystemQuestUser.xp += ecosystemQuestFound.reward;

		ecosystemQuestToClaim.done = true;

		const level = await updateLevel(ecosystemQuestUser.xp, ecosystemQuestUser.badges, ecosystemQuestUser._id.toString());

		ecosystemQuestUser.level = level;

		await xpLog.create({
      address: ecosystemQuestUser.address,
			username: ecosystemQuestUser.username,
			amount: ecosystemQuestFound.reward,
			status: "success",
			type: "ecosystem-quest"
    });

		await ecosystemQuestToClaim.save();
		await ecosystemQuestUser.save();

		res.status(OK).json({ message: "ecosystem quest claimed" });
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "error claiming ecosystem quest" });
	}
};

export const setTimer = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
		if (!id) {
			res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
			return;
		}

		const questForEcosystem = await ecosystemQuest.findById(id).lean();
		if (!questForEcosystem) {
			res
				.status(NOT_FOUND)
				.json({ error: "invalid id associated with ecosystem quest" });
			return;
		}

		const now = new Date();

		const timer = new Date(now.getTime() + 1 * 60 * 1000);

		const ecoQuest = await ecosystemQuestCompleted.findOne({
			user: req.id,
			ecosystemQuest: id,
		});

		if (!ecoQuest) {
			await ecosystemQuestCompleted.create({
				done: false,
				timer,
				ecosystemQuest: id,
				user: req.id,
			});

			res.status(OK).json({ message: "timer set" });
			return;
		}

		res.status(OK).json({ message: "timer already set" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error setting timer" });
	}
};

// for quests requiring input submission for validation before quest completion
export const submitQuest = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const userId = req.id;

		// Destructure as hubId to avoid collision with the "hub" model import
		const { submissionLink, questId, page, id, tag, hub: hubId } = req.body;
		if (!submissionLink || !questId || !page || !id || !tag) {
			res.status(BAD_REQUEST).json({ error: "send required details" });
			return;
		}

		const userExists = await user.findById(userId).lean();
		if (!userExists) {
			res.status(NOT_FOUND).json({ error: "id is invalid or does not exists" });
			return;
    }

    if (environment === "production") {
  		if (!userExists.socialProfiles?.x?.connected) {
  			res.status(BAD_REQUEST).json({ error: "user x profile not linked" });
  			return;
      }
    }

    if (hubId) {
  		const hubExists = (await hub.findById(hubId)) || (await userHub.findById(hubId));
  		if (!hubExists) {
  			res.status(BAD_REQUEST).json({ error: "hub does not exist" });
  			return;
  		}
    }

		let notComplete;

		const submissionExists = await submission.findOne({ miniQuestId: id, user: userId, page, hub: hubId }).lean();
		if (submissionExists) {
			res.status(BAD_REQUEST).json({ error: "quest already submitted" });
			return;
		}

		let questExists;
		let resolvedHub = hubId;

		if (page !== "campaign") {
			questExists = await miniQuest.findById(id);
			if (!questExists) {
				res.status(BAD_REQUEST).json({ error: "mini quest id is invalid" });
				return;
			}

			// Resolve the hub from the parent quest so submissions always land in the creator's dashboard
			if (!resolvedHub && questExists.quest) {
				const parentQuest = await quest.findById(questExists.quest).select("hub").lean();
				resolvedHub = parentQuest?.hub?.toString() || hubId;
			}

			notComplete = await miniQuestCompleted.create({ miniQuest: id, quest: questId, user: userId });
		} else {
			questExists = await campaignQuest.findById(id);
			if (!questExists) {
				res.status(BAD_REQUEST).json({ error: "campaign quest id is invalid" });
				return;
			}
			notComplete = await campaignQuestCompleted.create({ campaign: questId, campaignQuest: id, user: userId });
		}

		await submission.create({ submissionLink, hub: resolvedHub ?? "nexura-hub", taskType: tag, address: userExists.address, username: userExists.socialProfiles?.x?.username || userExists.username, miniQuestId: id, user: userId, page, questCompleted: notComplete._id });

		res.status(OK).json({ message: "quest submitted" });
	} catch (error: any) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: error?.message || "error submitting quest" });
	}
};

export const createQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const requestData: ICreateQuest = req.body;
		const coverImageAsFile = req.file?.buffer;

    const hubUserId = req.admin.hub;

    const { error } = validateQuestData(req.body);
    if (error) {
      const emptyFields = getMissingFields(error);
      res.status(BAD_REQUEST).json({ error: `Missing required fields: ${emptyFields}` });
      return;
    }

    const page = req.body.page;

    let createdHub: any;

    if (page === "user") {
  		createdHub = await userHub.findById(hubUserId);
  		if (!createdHub) {
  			res
  				.status(NOT_FOUND)
  				.json({ error: "id associated with user hub is invalid" });
  			return;
  		}
    } else {
      createdHub = await hub.findById(hubUserId);
  		if (!createdHub) {
  			res
  				.status(NOT_FOUND)
  				.json({ error: "id associated with hub is invalid" });
  			return;
  		}
    }

		if (!coverImageAsFile) {
			res
				.status(BAD_REQUEST)
				.json({ error: "hub cover image is required" });
			return;
		}

		const projectCoverImageUrl = await uploadImg({
			file: coverImageAsFile,
			filename: req.file?.originalname as string,
			folder: "cover-images",
			maxSize: 2 * 1024 ** 2, // 2 MB
		});

		const startsAt = parseDate(requestData.starts_at);
		const endsAt = parseDate(requestData.ends_at);
		if (startsAt) requestData.starts_at = startsAt;
		if (endsAt) requestData.ends_at = endsAt;

		requestData.projectCoverImage = projectCoverImageUrl;

		requestData.project_image = createdHub.logo;
    if (!requestData.project_name) {
      requestData.project_name = createdHub.name || "";
    }

    // Use xp from frontend form as reward
    if (!requestData.reward && (requestData as any).xp) {
      requestData.reward = Number((requestData as any).xp);
    }

    if (!(requestData as any).sub_title) {
      (requestData as any).sub_title = requestData.description || createdHub.description || "";
    }

		const newQuest = new quest(requestData);

    newQuest.creator = createdHub._id;
    newQuest.hub = createdHub._id;
  
    newQuest.creatorModel = page === "user" ? "user" : "admin";

    // Enforce Save status for all new quests from Studio.
    // Quests must be explicitly published via /publish-quest which requires payment.
    newQuest.status = "Save";

    createdHub.questsCreated += 1;

    newQuest.questNumber = createdHub.questsCreated;

		const rawMiniQuests = req.body.miniQuests;
		const miniQuestsFromBody: Record<string, any>[] = typeof rawMiniQuests === "string"
      ? (() => { try { return JSON.parse(rawMiniQuests); } catch { return []; } })()
      : (Array.isArray(rawMiniQuests) ? rawMiniQuests : []);


		const manyData: any[] = [];

		if (miniQuestsFromBody.length > 0) {
			for (const mq of miniQuestsFromBody) {
				mq.text = mq.quest || mq.text || "";
				mq.quest = newQuest._id;
				manyData.push(mq);
			}

			await miniQuest.insertMany(manyData);
		}

    newQuest.noOfQuests = miniQuestsFromBody.length;

    await Promise.all([
  		newQuest.save(),
  		createdHub.save(),
    ]);

		res.status(CREATED).json({ message: "quest created!", questId: newQuest._id });
  } catch(error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error creating quest" });
  }
}

export const saveQuestWithMiniQuests = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (typeof req.body.miniQuests === "string") try { req.body.miniQuests = JSON.parse(req.body.miniQuests); } catch { /* leave */ }

    const { error } = validateQuestData(req.body);
    if (error) {
      const emptyFields = getMissingFields(error);
      res.status(BAD_REQUEST).json({ error: `Missing required fields: ${emptyFields}` });
      return;
    }

    let hubFound: any;

    if (req.body.page === "user") {
      hubFound = await userHub.findById(req.admin.hub).lean();
      if (!hubFound) {
        res.status(BAD_REQUEST).json({ error: "create a user hub to continue" });
        return;
      }
    } else {
      const hubFound = await hub.findById(req.admin.hub).lean();
      if (!hubFound) {
        res.status(BAD_REQUEST).json({ error: "create a hub to continue" });
        return;
      }
    }

    const { id } = req.query as { id: string };

    let questId = id;
    if (!questId) {
      const coverImageBuffer = req.file?.buffer;

      if (!coverImageBuffer) {
        res.status(BAD_REQUEST).json({ error: "cover image is required" });
        return;
      }

      req.body.projectCoverImage = await uploadImg({
        file: coverImageBuffer,
        filename: req.file?.originalname,
        folder: "cover-images",
        maxSize: 2 * 1024 ** 2
      });

      // Enforce Save status for new quests from Studio.
      req.body.status = "Save";

      const savedQuest = await quest.create(req.body);

      questId = savedQuest._id.toString();
    } else {
      const questFound = await quest.findById(questId).lean();
      if (!questFound) {
        res.status(NOT_FOUND).json({ error: "quest not found" });
        return;
      }

      // If it's a draft, don't allow status update via this endpoint.
      if (questFound.status === "Save") {
        delete req.body.status;
        if (req.body.questData) delete req.body.questData.status;
      }

      await quest.findByIdAndUpdate(id, req.body.questData || req.body, { new: true });
    }

    const { error: questError } = validateMiniQuestData(req.body.questData);
    if (questError) {
      const emptyFields = getMissingFields(questError);
      res.status(BAD_REQUEST).json({ error: `Missing required fields: ${emptyFields}` });
      return;
    }

    const createdMiniQuests = [];

    const newMiniQuests = [];

    for (const qd of req.body.questData) {
      const questData = { ...qd };

      if (qd.quest && qd._id) {
        createdMiniQuests.push({
          updateOne: {
            filter: { _id: qd._id },
            update: {
              $set: {
                ...questData,
              }
            }
          }
        });
      } else {
        qd.quest = questId;
        newMiniQuests.push({ ...qd,  })
      }
    }

    if (createdMiniQuests.length && !newMiniQuests.length) {
      await miniQuest.bulkWrite(createdMiniQuests);
    } else if (!createdMiniQuests.length && newMiniQuests.length) {
      await miniQuest.insertMany(newMiniQuests);
    } else {
      await miniQuest.bulkWrite(createdMiniQuests);
      await miniQuest.insertMany(newMiniQuests);
    }

    res.status(NO_CONTENT).send();
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error saving quest with mini quest" });
  }
}

export const saveQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (typeof req.body.reward === "string") {
      try { req.body.reward = JSON.parse(req.body.reward); } catch { /* leave as-is */ }
    }

    req.body.starts_at = normalizeCampaignDateInput(req.body.starts_at);
    req.body.ends_at = normalizeCampaignDateInput(req.body.ends_at);

    let hubFound: any;

    const page = req.body.page;

    if (page === "user") {
      hubFound = await userHub.findById(req.admin.hub).lean();
      if (!hubFound) {
        res.status(BAD_REQUEST).json({ error: "create a user hub to continue" });
        return;
      }
    } else {
      hubFound = await hub.findById(req.admin.hub).lean();
      if (!hubFound) {
        res.status(BAD_REQUEST).json({ error: "create a hub to continue" });
        return;
      }
    }

    if (!req.body.nameOfProject) {
      req.body.nameOfProject = hubFound.name || "";
    }

    // Parse miniQuests if provided
    let miniQuestsToSave: any[] | null = null;
    if (req.body.miniQuests !== undefined) {
      try {
        miniQuestsToSave = typeof req.body.miniQuests === "string"
          ? JSON.parse(req.body.miniQuests)
          : req.body.miniQuests;
      } catch { /* ignore */ }
    }

    const { error } = validateSaveQuestData(req.body);
    if (error) {
      const emptyFields = getMissingFields(error);
      res.status(BAD_REQUEST).json({ error: `Missing required fields: ${emptyFields}` });
      return;
    }

    const coverImageBuffer = req.file?.buffer;
    const { hubCoverImage } = req.body;

    if (hubCoverImage && coverImageBuffer) {
      // remove previous cover image
      req.body.coverImage = await uploadImg({
        file: coverImageBuffer,
        filename: req.file?.originalname,
        folder: "cover-images",
        maxSize: 2 * 1024 ** 2
      });
    } else if (coverImageBuffer && !hubCoverImage) {
      req.body.coverImage = await uploadImg({
        file: coverImageBuffer,
        filename: req.file?.originalname,
        folder: "cover-images",
        maxSize: 2 * 1024 ** 2
      });
    }

    const { id } = req.query as { id: string };
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      res.status(BAD_REQUEST).json({ error: "invalid quest id" });
      return;
    }
    if (!id) {
      // Fill in defaults for required model fields not yet provided in a draft
      const [questCount] = await Promise.all([
        quest.countDocuments({ creator: req.id }),
      ]);

      const body = {
        ...req.body,
        description: req.body.description || hubFound.description || "Untitled Quest",
        project_image: hubFound.logo ?? "pending",
        project_name: hubFound.name ?? req.body.nameOfProject ?? "",
        sub_title: req.body.description || hubFound.description || "",
        questNumber: questCount + 1,
        projectCoverImage: req.body.coverImage ?? "pending",
        creator: req.admin.hub,
        creatorModel: page === "user" ? "user" : "project",
        status: "Save", // Enforce Save status for new quests from Studio
      };

      const savedQuest = await quest.create(body);
      const savedQuestId = savedQuest._id;

      // Save quests
      if (miniQuestsToSave !== null) {
        await miniQuest.deleteMany({ quest: savedQuestId });
        if (miniQuestsToSave.length > 0) {
          await miniQuest.insertMany(
            miniQuestsToSave.map((q: any) => (
              { ...q, quest: savedQuestId }))
          );
        }
        await quest.findByIdAndUpdate(savedQuestId, { noOfQuests: miniQuestsToSave.length });
      }

      res.status(CREATED).json({ message: 'Quest saved successfully', questId: savedQuest._id });
      return;
    }

    const questFound = await quest.findById(id).lean();
    if (!questFound) {
      const questCount = await quest.countDocuments({ creator: req.id });
      const body = {
        ...req.body,
        project_image: hubFound.logo ?? "pending",
        project_name: hubFound.name ?? req.body.nameOfProject ?? "",
        sub_title: req.body.description || hubFound.description || "",
        questNumber: questCount + 1,
        projectCoverImage: req.body.coverImage ?? "pending",
        creator: req.admin.hub,
        creatorModel: page === "user" ? "user" : "project",
        status: "Save", // Enforce Save status for new quests from Studio
      };

      const newQuest = await quest.create(body);

      if (miniQuestsToSave !== null) {
        if (miniQuestsToSave.length > 0) {
          await miniQuest.insertMany(
            miniQuestsToSave.map((q: any) => ({ ...q, text: q.quest || q.text || "", quest: newQuest._id }))
          );
        }
        await quest.findByIdAndUpdate(newQuest._id, { noOfQuests: miniQuestsToSave.length });
      }

      res.status(CREATED).json({ questId: newQuest._id });
      return;
    }

    const { miniQuests: _mq, isDraft: _d, existingCoverImage: _e, hubCoverImage: _h, nameOfProject: _n, ...updateFields } = req.body;

    // If it's a draft, don't allow status update via this endpoint.
    if (questFound.status === "Save") {
      delete updateFields.status;
    }

    if (updateFields.description !== undefined) {
      const trimmed = String(updateFields.description ?? "").trim();
      if (trimmed) {
        updateFields.description = trimmed;
        updateFields.sub_title = trimmed;
      } else {
        delete updateFields.description;
      }
    }

    const incomingNameOfProject = typeof req.body.nameOfProject === "string"
      ? req.body.nameOfProject.trim()
      : "";

    if (req.body.nameOfProject !== undefined || questFound.project_name) {
      updateFields.project_name = hubFound.name ?? incomingNameOfProject ?? questFound.project_name;
    }

    // Recalculate status atomically when dates change on a published campaign
    if (questFound.status !== "Save") {
      const now = new Date();

      const newStartsAt = updateFields.starts_at
        ? parseDate(updateFields.starts_at)
        : parseDate(questFound.starts_at);

      const newEndsAt = updateFields.ends_at
        ? parseDate(updateFields.ends_at)
        : parseDate(questFound.ends_at);

      if (newEndsAt && newEndsAt <= now) {
        updateFields.status = "Ended";
      } else if (newStartsAt && newStartsAt > now) {
        updateFields.status = "Scheduled";
      } else {
        updateFields.status = "Active";
      }
    }

    await quest.findByIdAndUpdate(id, updateFields, { new: true });

    // Update mini quests without destroying existing IDs/submissions
    if (miniQuestsToSave !== null) {
      const existingMiniQuests = await miniQuest.find({ quest: id }).select("_id").lean();
      const existingMiniQuestIds = existingMiniQuests.map((q: any) => q._id.toString());
      const incomingQuestIds = miniQuestsToSave
        .map((q: any) => q._id?.toString())
        .filter(Boolean);

      const miniQuestsToUpdate = miniQuestsToSave.filter((q: any) => q._id);
      const miniQuestsToInsert = miniQuestsToSave.filter((q: any) => !q._id);

      if (miniQuestsToUpdate.length > 0) {
        await miniQuest.bulkWrite(
          miniQuestsToUpdate.map((q: any) => {
            const { _id, ...rest } = q;
            if (rest.quest && !rest.text) {
              rest.text = rest.quest;
            }
            delete rest.quest;

            const updatePayload = { ...rest, quest: id };

            return {
              updateOne: {
                filter: { _id, quest: id as any },
                update: { $set: updatePayload },
              }
            };
          })
        );
      }

      if (miniQuestsToInsert.length > 0) {
        await miniQuest.insertMany(
          miniQuestsToInsert.map((q: any) => (
              { ...q, text: q.quest || q.text || "", quest: id }
          ))
        );
      }

      const miniuQuestIdsToDelete = existingMiniQuestIds.filter((existingId) => !incomingQuestIds.includes(existingId));
      if (miniuQuestIdsToDelete.length > 0) {
        await miniQuest.deleteMany({ _id: { $in: miniuQuestIdsToDelete }, quest: id });
      }

      await quest.findByIdAndUpdate(id, { noOfQuests: miniQuestsToSave.length });
    }

    res.status(OK).json({ questId: id });
  } catch (error: any) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: error?.message || "error saving quest" });
  }
}

export const deleteQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }
    
    const exists = await quest.exists({ _id: id }).select("_id").lean();
    if (!exists) {
      res.status(NOT_FOUND).json({ error: "quest not found" });
      return;
    }

    await Promise.all([
      quest.findByIdAndDelete(id),
      miniQuest.deleteMany({ quest: id }),
      miniQuestCompleted.deleteMany({ quest: id }),
      questCompleted.deleteMany({ quest: id }),
    ]);

    res.status(OK).json({ message: "quest deleted successfully" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting quest" });
  }
}

export const deleteMiniQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }

    const exists = await miniQuest.exists({ _id: id }).select("_id").lean();
    if (!exists) {
      res.status(NOT_FOUND).json({ error: "mini quest not found" });
      return;
    }

    await miniQuest.findByIdAndDelete(id);

    res.status(OK).json({ message: "mini quest deleted successfully" });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error deleting mini quest" });
  }
}

export const getTemporalQuestStatus = (doc: any): string | null => {
  if (doc.status === "Save") return "Save";
  if (doc.status === "Ended") return "Ended";
  if (doc.status === "Deleted") return "Deleted";

  const now = new Date();
  const startsAt = doc.starts_at ? new Date(doc.starts_at) : null;
  const endsAt = doc.ends_at ? new Date(doc.ends_at) : null;
  if (startsAt && startsAt > now) return "Scheduled";
  if (endsAt && endsAt < now) return "Ended";
  if (startsAt && startsAt <= now && (!endsAt || endsAt >= now)) return "Active";
  return null;
};

export const publishQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }

    const questDoc = await quest.findById(id);
    if (!questDoc) {
      res.status(NOT_FOUND).json({ error: "Quest not found" });
      return;
    }

    const { status } = req.body;
    if (status === "Ended") {
      questDoc.status = "Ended";
      await questDoc.save();
      res.status(OK).json({ message: "quest closed!" });
      return;
    }

    const now = new Date();
    let newStatus: "Active" | "Scheduled" | "Save" | "Ended";

    if (!questDoc.starts_at || new Date(questDoc.starts_at) <= now) {
      newStatus = "Active";
    } else {
      newStatus = "Scheduled";
    }

    if (questDoc.ends_at && new Date(questDoc.ends_at) <= now) {
      res.status(BAD_REQUEST).json({ error: "Cannot publish a quest that has already ended" });
      return;
    }

    if (newStatus === "Active") {
      const numberOfMiniQuests = await miniQuest.countDocuments({ quest: questDoc._id });
      if (numberOfMiniQuests < 5) {
        res.status(BAD_REQUEST).json({ error: "mini quests must be up to/greater than 5 to set quest as active" });
        return;
      }

      const updatedUser = await user.findByIdAndUpdate(req.admin.userId, { $inc: { xp: 2000 } });

      if (updatedUser) await xpLog.create({ status: "success", amount: 2000, type: "quest-creation", address: updatedUser.address, username: updatedUser.username });
    }

    questDoc.status = newStatus;
    await questDoc.save();

    await consumePaymentHash((req as any).admin?.hub);

    res.status(OK).json({ message: "quest published!" });
  } catch (error) {
    logger.error("Error publishing quest: " + error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error publishing quest" });
  }
};

  export const getHubQuests = async (req: GlobalRequest, res: GlobalResponse) => {
    try {
      const hubId = (req as any).hubId || (req as any).admin?.hub;
      if (!hubId) {
        res.status(BAD_REQUEST).json({ error: "No hub associated with this admin" });
        return;
      }

      const { userHub } = await import("@/models/hub.model");
      const hubDoc = await userHub.findById(hubId).select("systemKey").lean();
      if (!hubDoc) {
        res.status(NOT_FOUND).json({ error: "Hub not found" });
        return;
      }

      const isSystemHub = hubDoc.systemKey === "nexura-admin-campaigns";

      const query: any = { status: { $ne: "Deleted" } };

      if (isSystemHub) {
        query.hub = { $ne: null };
      } else {
        query.hub = hubId;
      }

      const quests = await quest.find(query).sort({ createdAt: -1 }).lean();

      const statusUpdates: any[] = [];
      const normalizedQuests = quests.map((q: any) => {
        const temporal = getTemporalQuestStatus(q);
        if (temporal && temporal !== q.status && q.status !== "Save" && q.status !== "Ended") {
          statusUpdates.push({ _id: q._id, status: temporal });
          return { ...q, status: temporal };
        }
        return q;
      });

      if (statusUpdates.length > 0) {
        await quest.bulkWrite(
          statusUpdates.map(({ _id, status }) => ({
            updateOne: { filter: { _id }, update: { $set: { status } } },
          }))
        );
      }

      res.status(OK).json({ message: "Quests fetched!", quests: normalizedQuests });
    } catch (error) {
      logger.error(error);
      res.status(INTERNAL_SERVER_ERROR).json({ error: "Error fetching hub quests" });
    }
  };

export const getAdminHubQuests = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const hubId = (req as any).hubId;
    if (!hubId) {
      res.status(BAD_REQUEST).json({ error: "No hub associated with this admin" });
      return;
    }
    const quests = await quest.find({ hub: hubId, status: { $ne: "Deleted" } }).sort({ createdAt: -1 }).lean();
    res.status(OK).json({ message: "Admin quests fetched!", quests });
  } catch (error) {
    logger.error("Error fetching admin hub quests: " + error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error fetching admin hub quests" });
  }
};

export const getAdminQuestDetail = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }
    const q = await quest.findById(id).lean();
    if (!q) {
      res.status(NOT_FOUND).json({ error: "Quest not found" });
      return;
    }
    res.status(OK).json({ message: "Quest detail fetched!", quest: q });
  } catch (error) {
    logger.error("Error fetching admin quest detail: " + error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error fetching admin quest detail" });
  }
};
