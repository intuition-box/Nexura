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
  validateSaveQuestData,
  startOfDayUTC,
	submissionProblem,
} from "@/utils/utils";
import mongoose from "mongoose";
import { hub, userHub } from "@/models/hub.model";
import { uploadImg } from "@/utils/img.utils";
import { parseDate, normalizeCampaignDateInput } from "@/utils/dates";
import { xpLog } from "@/models/xpLog.model";
import { consumePaymentHash } from "./studioPayment.controller";
import { environment } from "@/utils/env.utils";
import { refreshUserRetention } from "@/utils/retention";
import { payCompletedStageXp } from "@/utils/campaignXp";
import { checkTrustEligibility } from "@/utils/campaignRewards";
import { campaignRewardAsset } from "@/utils/rewardAssets";
import { resolveAdminCampaignHub } from "@/utils/adminCampaignHub";

// Image fields may hold empty strings or the literal "pending" (draft
// placeholder). Both must read as "no image" so the UI falls back gracefully
// instead of rendering a broken <img>.
const resolveImageUrl = (...candidates: unknown[]): string => {
	for (const candidate of candidates) {
		if (typeof candidate !== "string") continue;
		const value = candidate.trim();
		if (!value || value.toLowerCase() === "pending") continue;
		return value;
	}
	return "";
};

const DISCORD_CAMPAIGN_TAGS = new Set([
	"join",
	"message",
	"join-discord",
	"message-discord",
	"acquire-role-discord",
	"send-message-discord",
]);

// The only campaign tasks with nothing to verify: they complete when the person says so
const SELF_COMPLETE_CAMPAIGN_TAGS = new Set(["visit-website"]);

// Custom tasks ("other") have no automatic check, so they go to the hub for review like these
const PROOF_REQUIRED_CAMPAIGN_TAGS = new Set([
	"other",
	"comment",
	"comment-x",
	"follow",
	"follow-x",
	"repost-x",
	"feedback",
	"create-post",
	"wallet-address",
]);

// Ensures the overall quest-completion record exists for {quest, user} so the
// reward claim (claimQuest) can find it, regardless of which UI surface drove
// the task completion. Genuine completion endpoints (submit/verify/claim-mini)
// call this after confirming the user did the task. $setOnInsert leaves any
// existing record untouched, so a stale prior-day daily completion is not
// resurrected (the daily reset is still owned by startQuest).
export const ensureQuestStarted = async (questId: any, userId: any): Promise<void> => {
	if (!questId || !userId) return;
	await questCompleted.updateOne(
		{ quest: questId, user: userId },
		{ $setOnInsert: { quest: questId, user: userId, done: false, category: "one-time" } },
		{ upsert: true }
	);
};

// Ensures each submission in a review lane carries the linked quest's category
// (seasonal/featured/daily). New submissions store it at creation time; this
// backfills any that predate the field by resolving miniQuestId -> quest.
export const withSubmissionCategory = async (submissions: any[]): Promise<any[]> => {
	const missing = submissions.filter((s) => !s.category && s.miniQuestId);
	if (missing.length === 0) return submissions;

	const miniQuestIds = [...new Set(missing.map((s) => String(s.miniQuestId)))]
		.filter((id) => mongoose.Types.ObjectId.isValid(id));
	if (miniQuestIds.length === 0) return submissions;

	const miniQuests = await miniQuest.find({ _id: { $in: miniQuestIds } }).select("_id quest").lean();
	const questIds = [...new Set(miniQuests.map((m: any) => m.quest?.toString()).filter(Boolean))];
	const quests = await quest.find({ _id: { $in: questIds } }).select("_id category").lean();

	const questCategoryById = new Map(quests.map((q: any) => [q._id.toString(), q.category]));
	const categoryByMiniQuestId = new Map(
		miniQuests.map((m: any) => [m._id.toString(), questCategoryById.get(m.quest?.toString())])
	);

	return submissions.map((s) =>
		s.category ? s : { ...s, category: categoryByMiniQuestId.get(String(s.miniQuestId)) }
	);
};

// todo: add ecosystem completed to eco quests
export const fetchEcosystemDapps = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const ecosystemQuests = await ecosystemQuest.find({ status: "active" }).lean();
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
			mergedEcoQuest.reviewStatus = ecoQuestCompleted?.done ? "done" : (ecoQuestCompleted?.status ?? null);

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

		const questsInDB = await quest.find({ status: { $ne: "Save" }, isPublished: { $ne: false } }).lean();
		const completedQuests = await questCompleted.find({
			user: new mongoose.Types.ObjectId(req.id),
		}).lean().select("_id done quest updatedAt");

		const startOfToday = startOfDayUTC();

		// Resolve each quest's task tag so the main app can detect relic / portal-claim
		// (i-*) quests. Featured/daily are single-task, so the first mini-quest is the
		// quest's task. Batched to avoid an N+1 lookup.
		const allMiniQuests = await miniQuest
			.find({ quest: { $in: questsInDB.map((q) => q._id) } })
			.select("_id tag link quest")
			.lean();
		const firstMiniQuestByQuestId = new Map<string, any>();
		for (const mq of allMiniQuests) {
			const key = mq.quest?.toString();
			if (key && !firstMiniQuestByQuestId.has(key)) firstMiniQuestByQuestId.set(key, mq);
		}

		// This user's submission/approval state for each quest's single task, so the
		// card can reflect submitted/pending/approved/completed. Batched to avoid N+1.
		const allMiniQuestCompleted = await miniQuestCompleted
			.find({ user: new mongoose.Types.ObjectId(req.id), quest: { $in: questsInDB.map((q) => q._id) } })
			.select("quest status done updatedAt")
			.lean();
		const miniQuestCompletedByQuestId = new Map<string, any>();
		for (const mqc of allMiniQuestCompleted) {
			const key = mqc.quest?.toString();
			if (key) miniQuestCompletedByQuestId.set(key, mqc);
		}

		const quests: any[] = [];

		for (const singleQuest of questsInDB) {
			const singleQuestCompleted = completedQuests.find(
			(completedQuest) => completedQuest.quest?.toString() === singleQuest._id.toString()
			);

			const mergedQuest: Record<any, unknown> = singleQuest;

			// Daily quests reset each UTC day: a completion from a prior day reads
			// as not-completed/not-joined so the user can redo it today.
			const isStaleDaily =
				singleQuest.category === "daily" &&
				singleQuestCompleted &&
				(!singleQuestCompleted.updatedAt || new Date(singleQuestCompleted.updatedAt) < startOfToday);

			mergedQuest.done = singleQuestCompleted && !isStaleDaily ? singleQuestCompleted.done : false;
			mergedQuest.joined = !!singleQuestCompleted && !isStaleDaily;

			// This user's task submission state (pending/retry/approved/done) for the
			// single task, so the card can mirror the seasonal state machine. A stale
			// prior-day daily completion reads as not-submitted so it can be redone today.
			const taskCompleted = miniQuestCompletedByQuestId.get(singleQuest._id.toString());
			const isStaleDailyTask =
				singleQuest.category === "daily" &&
				taskCompleted &&
				(!taskCompleted.updatedAt || new Date(taskCompleted.updatedAt) < startOfToday);
			mergedQuest.taskStatus = taskCompleted && !isStaleDailyTask ? taskCompleted.status : "";
			mergedQuest.taskDone = taskCompleted && !isStaleDailyTask ? !!taskCompleted.done : false;

			// Expose the single task's tag so the main app can render the right action
			// (relic -> Check Relic / RelicScanModal, i-* -> atlas verify via check-atlas-task).
			const firstMiniQuest = firstMiniQuestByQuestId.get(singleQuest._id.toString());
			if (firstMiniQuest?.tag) {
				mergedQuest.taskType = firstMiniQuest.tag;
				mergedQuest.taskId = firstMiniQuest._id;
				mergedQuest.taskLink = firstMiniQuest.link;
				mergedQuest.isRelicQuest = firstMiniQuest.tag === "relic";
			}

			const temporalStatus = getTemporalQuestStatus(singleQuest);
			if (temporalStatus && temporalStatus !== singleQuest.status && singleQuest.status !== "Save" && singleQuest.status !== "Ended") {
				mergedQuest.status = temporalStatus;
				(mergedQuest as any)._needsStatusUpdate = temporalStatus;
			}

			// Resolve the creator hub so project_name and the creator icon stay in
			// sync with what the studio shows. Quests made by user admins reference
			// a `user-hubs` doc, so the collection must be picked by creatorModel —
			// looking only in the `hubs` collection silently misses user-hub quests.
			let creatorHub: any;
			if (singleQuest.hub) {
				creatorHub = singleQuest.creatorModel === "user"
					? await userHub.findById(singleQuest.hub).select('name logo systemKey').lean()
					: await Hub.findById(singleQuest.hub).select('name logo systemKey').lean();
				if (creatorHub) {
					// If it's a system hub (Nexura), show "Nexura" as creator
					if (creatorHub.systemKey === 'nexura-admin-campaigns') {
						mergedQuest.project_name = 'Nexura';
					} else {
						mergedQuest.project_name = creatorHub.name;
					}
				}
			}

			// Show the image actually uploaded for the quest when present; only fall
			// back to the hub logo (then the quest cover) otherwise. Never clobber a
			// stored image with an empty hub logo.
			mergedQuest.project_image =
				resolveImageUrl(singleQuest.project_image) ||
				resolveImageUrl(creatorHub?.logo) ||
				resolveImageUrl(singleQuest.projectCoverImage) ||
				"";

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

    const featuredQuests = [];
    const seasonalQuests = [];
    const dailyQuests = [];

    for (const q of quests) {
      if (q.category === "featured") {
        featuredQuests.push(q);
      } else if (q.category === "seasonal") {
        seasonalQuests.push(q);
      } else if (q.category === "daily") {
        dailyQuests.push(q);
      }
    }

		res
			.status(OK)
			.json({ message: "quests fetched!", quests: { featuredQuests, dailyQuests, seasonalQuests } });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error fetching quests" });
	}
};

export const performQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error performing quest" });
  }
}

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
			// User hubs may have an empty logo — fall back to the quest's own stored
			// images so the creator icon shows what was uploaded.
			logo: resolveImageUrl(currentHub?.logo, mainQuest.project_image, mainQuest.projectCoverImage),
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
			// The quest detail page reads `creatorCoverImage` for the banner; keep
			// `projectCoverImage` as well for backwards compatibility.
			creatorCoverImage: resolveImageUrl(mainQuest.projectCoverImage, mainQuest.project_image),
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

		const existingCompletion = await questCompleted.findOne({ quest: id, user: req.id }).lean();
		if (existingCompletion) {
			// Daily quests reset each UTC day: if the prior attempt is stale (from an
			// earlier UTC day) wipe this user's progress for the quest so they can redo it.
			const isStaleDaily =
				questExists.category === "daily" &&
				(!existingCompletion.updatedAt || new Date(existingCompletion.updatedAt) < startOfDayUTC());

			if (!isStaleDaily) {
				res.status(OK).json({ message: "quest already started" });
				return;
			}

			const userSubmissions = await submission.find({ user: req.id }).select("_id miniQuestId").lean();
			const miniQuestIdsForQuest = (await miniQuest.find({ quest: id }).select("_id").lean()).map((m: any) => m._id.toString());
			const submissionIdsToDelete = userSubmissions
				.filter((s: any) => miniQuestIdsForQuest.includes(String(s.miniQuestId)))
				.map((s: any) => s._id);

			await Promise.all([
				questCompleted.deleteOne({ _id: existingCompletion._id }),
				miniQuestCompleted.deleteMany({ quest: id, user: req.id }),
				submissionIdsToDelete.length ? submission.deleteMany({ _id: { $in: submissionIdsToDelete } }) : Promise.resolve(),
			]);
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

export const fetchCampaignQuests = async (req: GlobalRequest, res: GlobalResponse) => {
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

		// Finishing every task no longer releases the TRUST reward on its own: that waits for
		// eligibility (Nexura score + open stages done, see utils/campaignRewards.ts)
		if (currentCampaign.noOfQuests === campaignQuestsMarkedAsDone.length && completedCampaign && !completedCampaign.questsCompleted) {
			completedCampaign.questsCompleted = true;
			await completedCampaign.save();
		}
		// Keep stored retention in step with the tasks this person has completed, and pay any stage
		// that has unlocked since they finished it
		// Only for a signed-in person: without one, the lookups above match everyone's records
		if (userId && completedCampaign && campaignQuestsMarkedAsDone.length > 0) {
			void refreshUserRetention(userId);
			void payCompletedStageXp(userId, id);
		}

		const campaignNumber = padNumber(currentCampaign.campaignNumber);

		// The person's own progress towards the TRUST reward (also grants it the moment they qualify)
		const rewardEligibility = completedCampaign && userId ? await checkTrustEligibility(userId, id) : null;

		res.status(OK).json({
			message: "quests fetched!",
			rewardEligibility,
			// What the reward pool pays in (TRUST, USDC, …), so the app can name it
			rewardAsset: campaignRewardAsset(currentCampaign),
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

export const createCampaignQuests = async (req: GlobalRequest, res: GlobalResponse) => {
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
export const createEcosystemQuests = async (req: GlobalRequest, res: GlobalResponse) => {
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

export const performCampaignQuest = async (req: GlobalRequest, res: GlobalResponse) => {
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

			// Only tasks that can't be checked at all complete on request. Everything else must pass its
			// check first (X, on-chain, TNS, relic), which records the result this step relies on
			if (!SELF_COMPLETE_CAMPAIGN_TAGS.has(normalizedTag)) {
				res.status(FORBIDDEN).json({ error: "this task has to be verified before it can be completed" });
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
			// Pays the stage XP if this task finished a stage
			void payCompletedStageXp(req.id, normalizedCampaignId || undefined);
			return;
		}

		// "approved" means its check passed. A "pending" proof is still waiting for the hub's review, and
		// the hub's approval completes it, so the person can't complete it themselves
		if (campaignDone.status !== "approved") {
			res.status(BAD_REQUEST).json({ error: campaignDone.status === "pending"
				? "your submission is waiting for the project to review it"
				: "this task has to be verified before it can be completed" });
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
		// Pays the stage XP if this task finished a stage
		void payCompletedStageXp(req.id, normalizedCampaignId || undefined);

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

		// Daily quests reset each UTC day: a stale prior-day approval (or a stale
		// done:true from a prior-day claim retry) must not block today's claim.
		// Time source is server-only (startOfDayUTC()); see checkDiscordTask's
		// parallel guard on the verify path. Mirrors the daily-reset logic that
		// already lives in startQuest and fetchQuests' isStaleDailyTask merge.
		if (mainQuest.category === "daily") {
			const isStaleDailyTask =
				!miniQuestExists.updatedAt ||
				new Date(miniQuestExists.updatedAt) < startOfDayUTC();
			if (isStaleDailyTask) {
				await miniQuestCompleted.deleteOne({ _id: miniQuestExists._id });
				res.status(BAD_REQUEST).json({
					error: "task verification expired, please verify again today",
				});
				return;
			}
		}

		if (miniQuestExists.done === true) {
			res.status(FORBIDDEN).json({ error: "quest already claimed" });
			return;
		}

		if (miniQuestExists.status !== "done" && miniQuestExists.status !== "pending" && miniQuestExists.status !== "approved") {
			res.status(BAD_REQUEST).json({ error: "quest needs to be marked as pending before it can be caimed" });
			return;
		}

		miniQuestExists.done = true;
		miniQuestExists.status = "done";

		await miniQuestExists.save();

		// Guarantee the overall quest-completion record exists so the reward can be
		// claimed (claimQuest requires it) regardless of which surface started this.
		await ensureQuestStarted(questId, req.id);

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

		// Daily quests reset each UTC day: a "done" record from a prior UTC day does
		// not block today's claim (seasonal/featured stay permanently claimed).
		const dailyClaimedToday =
			questFound.category === "daily" &&
			isQuestCompleted.done &&
			isQuestCompleted.updatedAt &&
			new Date(isQuestCompleted.updatedAt) >= startOfDayUTC();
		const blockReclaim = questFound.category === "daily" ? dailyClaimedToday : isQuestCompleted.done;

		if (blockReclaim) {
			res.status(FORBIDDEN).json({ error: "quest already claimed" });
			return;
		}

		questUser.questsCompleted += 1;

		questUser.xp += questFound.reward;

		await questCompleted.updateOne({ quest: id, user: questUser._id }, { expires: new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000), done: true });

		// Mark this quest's task(s) done so the card reads "Completed" after the reward
		// is claimed (the card's completed state derives from the miniQuestCompleted
		// record). Without this an approved/verified task would keep showing "Claim XP".
		await miniQuestCompleted.updateMany({ quest: id, user: questUser._id }, { done: true, status: "done" });

		if (questUser.status !== "Active") {
			questUser.status = "Active";

			const userReferred = await referredUsers.findOne({ newUser: questUser._id });
			if (userReferred && userReferred.status !== "Active") {
				userReferred.status = "Active";

				await userReferred.save();
			}
		}

		const level = await updateLevel(questUser);

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

export const claimEcosystemQuest = async (req: GlobalRequest, res: GlobalResponse) => {
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

		const ecosystemQuestToClaim = await ecosystemQuestCompleted.findOneAndUpdate(
			{ user: userId, ecosystemQuest: id, status: "approved", done: { $ne: true } },
			{ $set: { done: true, status: "done" } },
			{ new: true }
		);

		if (!ecosystemQuestToClaim) {
			const existing = await ecosystemQuestCompleted.findOne({ user: userId, ecosystemQuest: id }).lean();
			const error = existing?.done
				? "ecosystem quest has been completed"
				: existing?.status === "pending"
					? "your proof is still being reviewed"
					: existing?.status === "retry"
						? "your proof was not accepted, send a new one"
						: "send proof first, the reward can be claimed once it is approved";
			res.status(FORBIDDEN).json({ error });
			return;
		}

		ecosystemQuestUser.xp += ecosystemQuestFound.reward;

		const level = await updateLevel(ecosystemQuestUser);

		ecosystemQuestUser.level = level;

		await xpLog.create({
      address: ecosystemQuestUser.address,
			username: ecosystemQuestUser.username,
			amount: ecosystemQuestFound.reward,
			status: "success",
			type: "ecosystem-quest"
    });

		await ecosystemQuestUser.save();

		res.status(OK).json({ message: "ecosystem quest claimed" });
	} catch (error) {
		logger.error(error);
		res
			.status(INTERNAL_SERVER_ERROR)
			.json({ error: "error claiming ecosystem quest" });
	}
};

export const submitEcosystemQuest = async (req: GlobalRequest, res: GlobalResponse) => {
	try {
		const id = (req.query.id as string) || (req.body.id as string);
		const { submissionLink } = req.body;
		if (!id || !mongoose.Types.ObjectId.isValid(String(id)) || !submissionLink) {
			res.status(BAD_REQUEST).json({ error: "send the dapp id and a proof link" });
			return;
		}
		const linkProblem = submissionProblem(submissionLink);
		if (linkProblem) {
			res.status(BAD_REQUEST).json({ error: linkProblem });
			return;
		}

		const userExists = await user.findById(req.id).lean();
		if (!userExists) {
			res.status(NOT_FOUND).json({ error: "id is invalid or does not exists" });
			return;
		}

		if (environment === "production" && !userExists.socialProfiles?.x?.connected) {
			res.status(BAD_REQUEST).json({ error: "user x profile not linked" });
			return;
		}

		const dapp = await ecosystemQuest.findOne({ _id: id, status: "active" }).lean();
		if (!dapp) {
			res.status(NOT_FOUND).json({ error: "ecosystem dapp not found" });
			return;
		}

		const nexuraHub = await resolveAdminCampaignHub();

		let record = await ecosystemQuestCompleted.findOne({ user: req.id, ecosystemQuest: id });
		if (record?.done || record?.status === "done") {
			res.status(FORBIDDEN).json({ error: "ecosystem quest has been completed" });
			return;
		}
		if (record?.status === "pending" || record?.status === "approved") {
			res.status(BAD_REQUEST).json({ error: "proof already sent" });
			return;
		}

		if (!record) {
			record = await ecosystemQuestCompleted.create({ done: false, timer: new Date(), ecosystemQuest: id, user: req.id, status: "pending" });
		} else {
			record.status = "pending";
			await record.save();
		}

		const existingSubmission = await submission.findOne({ miniQuestId: String(id), user: req.id, page: "ecosystem" });
		if (existingSubmission) {
			existingSubmission.submissionLink = submissionLink;
			existingSubmission.status = "pending";
			existingSubmission.questCompleted = String(record._id);
			await existingSubmission.save();
		} else {
			await submission.create({
				submissionLink,
				hub: nexuraHub._id.toString(),
				taskType: "ecosystem",
				address: userExists.address,
				username: userExists.socialProfiles?.x?.username || userExists.username,
				miniQuestId: String(id),
				user: req.id,
				page: "ecosystem",
				questCompleted: String(record._id),
			});
		}

		res.status(OK).json({ message: "proof sent for review" });
	} catch (error) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error sending proof" });
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
		const linkProblem = submissionProblem(submissionLink);
		if (linkProblem) {
			res.status(BAD_REQUEST).json({ error: linkProblem });
			return;
		}

		const userExists = await user.findById(userId).lean();
		if (!userExists) {
			res.status(NOT_FOUND).json({ error: "id is invalid or does not exists" });
			return;
    }

    // Every proof submission needs a linked X account, on purpose: it makes fake accounts costlier
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

		const submissionExists = await submission.findOne({ miniQuestId: id, user: userId, page });

		if (submissionExists) {
			// Allow resubmission only if admin rejected (status = "retry")
			if (submissionExists.status !== "retry") {
				res.status(BAD_REQUEST).json({ error: "quest already submitted" });
				return;
			}

			// Update existing submission with new link and reset to pending
			submissionExists.submissionLink = submissionLink;
			submissionExists.status = "pending";
			await submissionExists.save();

			// Reset the linked completed model back to pending
			if (page !== "campaign") {
				await miniQuestCompleted.updateOne({ _id: submissionExists.questCompleted }, { status: "pending" });
			} else {
				await campaignQuestCompleted.updateOne({ _id: submissionExists.questCompleted }, { status: "pending" });
			}

			res.status(OK).json({ message: "quest resubmitted successfully" });
			return;
		}

		let questExists;
		let resolvedHub = hubId;
		let questCategory: string | undefined;

		if (page !== "campaign") {
			questExists = await miniQuest.findById(id);
			if (!questExists) {
				res.status(BAD_REQUEST).json({ error: "mini quest id is invalid" });
				return;
			}

			// Resolve the hub from the parent quest so submissions always land in the creator's dashboard
			if (questExists.quest) {
				const parentQuest = await quest.findById(questExists.quest).select("hub category").lean();
				if (!resolvedHub) resolvedHub = parentQuest?.hub?.toString() || hubId;
				questCategory = parentQuest?.category;
			}

			// Legacy/admin singular quests often have no hub on their parent quest. Fall back
			// to the admin-campaign system hub the dashboard review lane queries (getTasks),
			// instead of the "nexura-hub" placeholder that orphans the submission.
			if (!resolvedHub) {
				const adminCampaignHub = await resolveAdminCampaignHub();
				resolvedHub = adminCampaignHub._id.toString();
			}

			notComplete = await miniQuestCompleted.create({ miniQuest: id, quest: questId, user: userId, done: false, status: "pending" });

			// Guarantee the overall quest-completion record exists so the reward can be
			// claimed after this submission is approved (claimQuest requires it).
			await ensureQuestStarted(questId, userId);
		} else {
			questExists = await campaignQuest.findById(id);
			if (!questExists) {
				res.status(BAD_REQUEST).json({ error: "campaign quest id is invalid" });
				return;
			}

			const parentCampaign = questExists.campaign
				? await campaign.findById(questExists.campaign).select("hub").lean()
				: null;
			if (!parentCampaign) {
				res.status(BAD_REQUEST).json({ error: "campaign quest id is invalid" });
				return;
			}
			resolvedHub = parentCampaign.hub?.toString();

			// Fall back to the admin-campaign system hub if the campaign has no hub
			if (!resolvedHub) {
				const adminCampaignHub = await resolveAdminCampaignHub();
				resolvedHub = adminCampaignHub._id.toString();
			}

			notComplete = await campaignQuestCompleted.create({ campaign: parentCampaign._id, campaignQuest: id, user: userId });
		}

		await submission.create({ submissionLink, hub: resolvedHub ?? "nexura-hub", taskType: tag, address: userExists.address, username: userExists.socialProfiles?.x?.username || userExists.username, miniQuestId: id, user: userId, page, questCompleted: notComplete._id, category: questCategory });

		res.status(OK).json({ message: "quest submitted" });
	} catch (error: any) {
		logger.error(error);
		res.status(INTERNAL_SERVER_ERROR).json({ error: "error submitting quest" });
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

		// Creator icon: hub logo when set, otherwise the uploaded cover so the
		// quest never stores an empty icon (user hubs may have no logo yet).
		requestData.project_image = createdHub.logo || requestData.projectCoverImage || "";
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

      // Ensure the quest is always connected to the admin's hub so Discord
      // verification (checkDiscordTask) and project lookups work end-to-end.
      if (!req.body.hub) req.body.hub = req.admin.hub;
      if (!req.body.creator) req.body.creator = req.admin.hub;
      if (!req.body.creatorModel) req.body.creatorModel = req.body.page === "user" ? "user" : "admin";

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
        // Only tasks of this quest can be updated, and they can't be moved to another quest
        questData.quest = new mongoose.Types.ObjectId(questId);
        createdMiniQuests.push({
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(qd._id), quest: new mongoose.Types.ObjectId(questId) },
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

    // The quest model stores `reward` as a Number; the dashboard sends a
    // { xp, pool, trust } object. Coerce to the xp value so create/update don't
    // fail the Number cast.
    if (req.body.reward && typeof req.body.reward === "object") {
      req.body.reward = Number(req.body.reward.xp) || 0;
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

    // Parse mini quests (Studio sends `miniQuests`, the admin/dashboard path sends `campaignQuests`)
    let miniQuestsToSave: any[] | null = null;
    const rawMiniQuests = req.body.miniQuests ?? req.body.campaignQuests;
    if (rawMiniQuests !== undefined) {
      try {
        miniQuestsToSave = typeof rawMiniQuests === "string"
          ? JSON.parse(rawMiniQuests)
          : rawMiniQuests;
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
        project_image: hubFound.logo || req.body.coverImage || "pending",
        project_name: hubFound.name ?? req.body.nameOfProject ?? "",
        sub_title: req.body.description || hubFound.description || "",
        questNumber: questCount + 1,
        projectCoverImage: req.body.coverImage || hubFound.logo || "pending",
        creator: req.admin.hub,
        hub: req.admin.hub,
        creatorModel: page === "user" ? "user" : "admin",
        status: "Save", // Enforce Save status for new quests from Studio
      };

      const savedQuest = await quest.create(body);
      const savedQuestId = savedQuest._id;

      // Save quests
      if (miniQuestsToSave !== null) {
        await miniQuest.deleteMany({ quest: savedQuestId });
        if (miniQuestsToSave.length > 0) {
          await miniQuest.insertMany(
            miniQuestsToSave.map((q: any) => {
              const { quest: questText, ...rest } = q;
              return { ...rest, text: questText || q.text || "", quest: savedQuestId };
            })
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
        project_image: hubFound.logo || req.body.coverImage || "pending",
        project_name: hubFound.name ?? req.body.nameOfProject ?? "",
        sub_title: req.body.description || hubFound.description || "",
        questNumber: questCount + 1,
        projectCoverImage: req.body.coverImage || hubFound.logo || "pending",
        creator: req.admin.hub,
        hub: req.admin.hub,
        creatorModel: page === "user" ? "user" : "admin",
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

    const { miniQuests: _mq, isDraft: _d, existingCoverImage: _e, hubCoverImage: _h, nameOfProject: _n, coverImage: _c, ...updateFields } = req.body;

    // The quest model has no `coverImage` field: a freshly uploaded cover must
    // be written to `projectCoverImage`, otherwise edit-mode uploads are
    // silently dropped and the old/placeholder image keeps showing.
    if (typeof _c === "string" && _c.trim() && _c.trim().toLowerCase() !== "pending") {
      updateFields.projectCoverImage = _c.trim();
    }

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

            const updatePayload = { ...rest, quest: new mongoose.Types.ObjectId(id) };

            return {
              updateOne: {
                filter: {
                  _id: new mongoose.Types.ObjectId(_id),
                  quest: new mongoose.Types.ObjectId(id)
                },
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
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error saving quest" });
  }
}

export const saveSingleQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    if (typeof req.body.reward === "string") {
      try { req.body.reward = JSON.parse(req.body.reward); } catch { /* leave as-is */ }
    }
    if (req.body.reward && typeof req.body.reward === "object") {
      req.body.reward = Number(req.body.reward.xp) || 0;
    }

    const category = req.body.category;
    if (category !== "featured" && category !== "daily") {
      res.status(BAD_REQUEST).json({ error: "invalid category for single quest" });
      return;
    }

    const page = req.body.page;
    let hubFound: any;
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

    let tasks: any[] = [];
    const rawTasks = req.body.miniQuests ?? req.body.campaignQuests;
    if (rawTasks !== undefined) {
      try {
        tasks = typeof rawTasks === "string" ? JSON.parse(rawTasks) : rawTasks;
      } catch { /* ignore */ }
    }
    const firstTask = tasks?.[0];
    if (!firstTask) {
      res.status(BAD_REQUEST).json({ error: "a task is required" });
      return;
    }

    if (category === "daily" && firstTask.tag === "relic") {
      res.status(BAD_REQUEST).json({ error: "relic checker tasks are only allowed on featured quests" });
      return;
    }

    const firstTaskText = String(firstTask?.quest || firstTask?.text || "").trim();
    const fallbackTitle = category === "daily" ? "Daily Quest" : "Featured Quest";
    const title = String(req.body.title ?? "").trim() || firstTaskText || fallbackTitle;
    const description = String(req.body.description ?? "").trim() || (firstTaskText || fallbackTitle).slice(0, 100);
    const nameOfProject = String(req.body.nameOfProject ?? "").trim() || hubFound.name || fallbackTitle;
    const starts_at = normalizeCampaignDateInput(req.body.starts_at) || new Date().toISOString();
    const ends_at = normalizeCampaignDateInput(req.body.ends_at) || new Date("2999-12-31T00:00:00.000Z").toISOString();

    const { id } = req.query as { id: string };
    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      res.status(BAD_REQUEST).json({ error: "invalid quest id" });
      return;
    }

    const buildMiniQuest = (questId: any) => {
      const { quest: questText, _id, ...rest } = firstTask;
      return { ...rest, text: questText || firstTask.text || "", quest: questId };
    };

    const existingQuest = id ? await quest.findById(id).lean() : null;

    let uploadedIconUrl: string | undefined;
    const iconFileBuffer = req.file?.buffer;
    if (iconFileBuffer) {
      uploadedIconUrl = await uploadImg({
        file: iconFileBuffer,
        filename: req.file?.originalname as string,
        folder: "cover-images",
        maxSize: 2 * 1024 ** 2, // 2 MB
      });
    }

    if (!existingQuest) {
      const questCount = await quest.countDocuments({ creator: req.admin.hub });
      const body = {
        title,
        description,
        category,
        reward: req.body.reward,
        page,
        nameOfProject,
        sub_title: description,
        project_image: uploadedIconUrl || hubFound.logo || "pending",
        project_name: hubFound.name ?? nameOfProject,
        projectCoverImage: uploadedIconUrl || hubFound.logo || "pending",
        questNumber: questCount + 1,
        starts_at,
        ends_at,
        creator: req.admin.hub,
        hub: req.admin.hub,
        creatorModel: page === "user" ? "user" : "admin",
        status: "Save",
      };
      const savedQuest = await quest.create(body);
      await miniQuest.deleteMany({ quest: savedQuest._id });
      await miniQuest.create(buildMiniQuest(savedQuest._id));
      await quest.findByIdAndUpdate(savedQuest._id, { noOfQuests: 1 });
      res.status(CREATED).json({ questId: savedQuest._id });
      return;
    }

    await quest.findByIdAndUpdate(id, {
      title,
      description,
      category,
      reward: req.body.reward,
      nameOfProject,
      sub_title: description,
      starts_at,
      ends_at,
      ...(uploadedIconUrl ? { project_image: uploadedIconUrl, projectCoverImage: uploadedIconUrl } : {}),
    });
    await miniQuest.deleteMany({ quest: id });
    await miniQuest.create(buildMiniQuest(id));
    await quest.findByIdAndUpdate(id, { noOfQuests: 1 });
    res.status(OK).json({ questId: id });
  } catch (error: any) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error saving single quest" });
  }
};

export const publishSingleQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }

    const adminHub = req.admin?.hub ? String(req.admin.hub) : null;
    if (!adminHub) {
      res.status(BAD_REQUEST).json({ error: "Admin has no associated hub" });
      return;
    }

    const questDoc = await quest.findById(id);
    if (!questDoc) {
      res.status(NOT_FOUND).json({ error: "Quest not found" });
      return;
    }

    if (String(questDoc.creator) !== adminHub) {
      res.status(FORBIDDEN).json({ error: "You are not allowed to publish this quest" });
      return;
    }

    const { status } = req.body || {};
    if (status === "Ended") {
      questDoc.status = "Ended";
      await questDoc.save();
      res.status(OK).json({ message: "Quest closed successfully!" });
      return;
    }

    if (questDoc.status !== "Save") {
      res.status(BAD_REQUEST).json({ error: "Quest is not in draft status" });
      return;
    }

    const now = new Date();
    let newStatus: "Active" | "Scheduled";
    if (!questDoc.starts_at || new Date(questDoc.starts_at) <= now) {
      newStatus = "Active";
    } else {
      newStatus = "Scheduled";
    }

    if (questDoc.ends_at && new Date(questDoc.ends_at) <= now) {
      res.status(BAD_REQUEST).json({ error: "Cannot publish a quest that has already ended" });
      return;
    }

    questDoc.status = newStatus;
    await questDoc.save();

    res.status(OK).json({ message: "Quest published successfully!" });
  } catch (error: any) {
    logger.error("Error publishing single quest: " + error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error publishing quest" });
  }
};

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

// Dedicated delete for single (featured/daily) quests so they don't share the
// seasonal delete path. Verifies the quest belongs to the admin's hub, then
// removes the quest, its mini-quest, and any completion/submission records.
export const deleteSingleQuest = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(BAD_REQUEST).json({ error: "valid quest id is required" });
      return;
    }

    const adminHub = req.admin?.hub ? String(req.admin.hub) : null;
    if (!adminHub) {
      res.status(BAD_REQUEST).json({ error: "Admin has no associated hub" });
      return;
    }

    const questDoc = await quest.findById(id).select("_id creator").lean();
    if (!questDoc) {
      res.status(NOT_FOUND).json({ error: "quest not found" });
      return;
    }
    if (String(questDoc.creator) !== adminHub) {
      res.status(FORBIDDEN).json({ error: "You are not allowed to delete this quest" });
      return;
    }

    const miniQuestIds = (await miniQuest.find({ quest: id }).select("_id").lean()).map((m: any) => m._id);

    await Promise.all([
      quest.findByIdAndDelete(id),
      miniQuest.deleteMany({ quest: id }),
      miniQuestCompleted.deleteMany({ quest: id }),
      questCompleted.deleteMany({ quest: id }),
      submission.deleteMany({ miniQuestId: { $in: miniQuestIds } }),
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

    const { status } = req.body || {};
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

    res.status(OK).json({ message: "Admin quests fetched!", quests: normalizedQuests });
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

    const temporal = getTemporalQuestStatus(q);
    if (temporal && temporal !== q.status && q.status !== "Save" && q.status !== "Ended") {
      await quest.updateOne({ _id: q._id }, { $set: { status: temporal } });
      (q as any).status = temporal;
    }

    res.status(OK).json({ message: "Quest detail fetched!", quest: q });
  } catch (error) {
    logger.error("Error fetching admin quest detail: " + error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "Error fetching admin quest detail" });
  }
};

// Admin toggle for a quest's publish state. Unpublished quests are hidden from
// the main app (see fetchQuests' isPublished filter). Superadmin-gated by route.
export const toggleQuestPublish = async (req: GlobalRequest, res: GlobalResponse) => {
  try {
    const id = (req.query.id as string) || (req.body.id as string) || (req.body.questId as string);
    if (!id) {
      res.status(BAD_REQUEST).json({ error: "Quest ID is required" });
      return;
    }

    const adminHub = req.admin?.hub ? String(req.admin.hub) : null;
    if (!adminHub) {
      res.status(BAD_REQUEST).json({ error: "Admin has no associated hub" });
      return;
    }

    const questDoc = await quest.findById(id);
    if (!questDoc) {
      res.status(NOT_FOUND).json({ error: "quest not found" });
      return;
    }

    if (String(questDoc.creator) !== adminHub) {
      res.status(FORBIDDEN).json({ error: "You are not allowed to update this quest" });
      return;
    }

    if (questDoc.category !== "featured" && questDoc.category !== "daily") {
      res.status(BAD_REQUEST).json({ error: "Only featured or daily quests can be published/unpublished" });
      return;
    }

    questDoc.isPublished = questDoc.isPublished === false;
    await questDoc.save();

    res.status(OK).json({ message: "quest publish state updated", quest: questDoc });
  } catch (error) {
    logger.error(error);
    res.status(INTERNAL_SERVER_ERROR).json({ error: "error toggling quest publish state" });
  }
};
