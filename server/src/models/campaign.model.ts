import mongoose, { Schema } from "mongoose";

const campaignSchema = new Schema({
	title: {
		type: String,
		required: true,
	},
	project_image: {
		type: String,
		required: true,
	},
	project_name: {
		type: String,
		required: true,
		default: "Nexura"
	},
	description: {
		type: String,
		required: true,
	},
	starts_at: {
		type: String,
		required: true,
	},
	totalXpAvailable: {
		type: Number,
		required: true,
	},
	xpClaimed: {
		type: Number,
		default: 0,
	},
	totalTrustAvailable: {
		type: Number,
		required: true,
	},
	trustClaimed: {
		type: Number,
		default: 0,
	},
	ends_at: {
		type: String,
		required: true,
	},
	participants: {
		type: Number,
		default: 0,
	},
	maxParticipants: {
		type: Number,
		default: 0,
	},
	sub_title: {
		type: String,
		required: true,
	},
	campaignNumber: {
		type: Number,
		required: true,
	},
	status: {
		type: String,
		default: "Save",
		enum: ["Active", "Scheduled", "Ended", "Save", "Deleted"],
	},
	deletedAt: {
		type: Date,
		default: null,
	},
	discordLaunchGuildId: {
		type: String,
		default: "",
	},
	contractAddress: {
		type: String,
	},
	rewardsDeployment: {
		txHash: {
			type: String,
		},
		fundedAmount: {
			type: Number,
		},
		rewardPerParticipant: {
			type: Number,
		},
		maxClaimableParticipants: {
			type: Number,
		},
		remainderWithdrawalTxHash: {
			type: String,
		},
		remainderWithdrawnAmount: {
			type: Number,
		},
		remainderWithdrawnAt: {
			type: Date,
		},
	},
	reward: {
		xp: {
			type: Number,
			required: true,
		},
		trustTokens: {
			type: Number,
			default: 0,
		},
		pool: {
			type: Number,
			required: true
		}
	},
	noOfQuests: {
		type: Number,
		default: 0,
	},
	projectCoverImage: {
		type: String,
		required: true,
	},
	hub: {
		type: mongoose.Schema.Types.ObjectId,
    ref: "hubs",
		required: true
	},
	// ── Retention campaign builder (Create Campaign) ──
	templateId: {
		type: String,
		default: null,
	},
	// Journey stages, in order. Each campaign quest points at a stage by `key`.
	stages: [{
		_id: false,
		key: { type: String, required: true },
		name: { type: String, required: true },
		order: { type: Number, default: 0 },
		returnDays: { type: Number, default: 0 },
		allocationPct: { type: Number, default: null },
	}],
	rewardsEnabled: {
		type: Boolean,
		default: false,
	},
	// What the project set on the Rewards & Funding step
	// The asset the reward pool pays in (see utils/rewardAssets.ts); set from rewardsConfig when saved
	rewardAsset: {
		network: { type: String },
		token: { type: String },
		chainId: { type: Number },
		decimals: { type: Number },
		native: { type: Boolean },
		tokenAddress: { type: String },
	},
	rewardsConfig: {
		budget: { type: Number },
		token: { type: String },
		network: { type: String },
		recipients: { type: Number },
		nexuraScoreRequirementPct: { type: Number },
		// Older campaigns stored the Nexura score requirement here
		retentionRequirementPct: { type: Number },
		participantPool: { type: Number },
		validationRewardsOn: { type: Boolean },
		curatorRewardsOn: { type: Boolean },
		curatorAddress: { type: String },
		totalPaid: { type: Number },
		paymentTxHash: { type: String },
	},
	// Everything the Create Campaign builder needs to reopen a draft exactly where it was left
	// (field values, current step, reward settings). Owned by the studio client.
	builderState: {
		type: Schema.Types.Mixed,
		default: null,
	},
	// Set when an approved governance proposal schedules this campaign to end
	endProposal: {
		ref: { type: String },
		executedAt: { type: Date },
		endsAt: { type: String },
	},
	// Wallet signature of the admin who published the campaign
	publishSignature: {
		address: { type: String },
		signature: { type: String },
		scheme: { type: String, enum: ["typed", "text"], default: "typed" },
		message: { type: Schema.Types.Mixed },
		adminId: { type: String },
		signedAt: { type: Date },
	},
}, { timestamps: true });

export const campaign = mongoose.model("campaigns", campaignSchema);

const campaignCompletedSchema = new Schema({
	questsCompleted: {
		type: Boolean,
		default: false,
	},
	campaignCompleted: {
		type: Boolean,
		default: false,
	},
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "user",
	},
	campaign: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "campaign",
	},
	// Retention on this campaign: stages fully completed out of all stages (see utils/retention.ts)
	stagesCompleted: { type: Number, default: 0 },
	stagesTotal: { type: Number, default: 0 },
	retentionRate: { type: Number, default: null },
	// Stage keys whose XP has been paid, and the XP paid so far (see utils/campaignXp.ts)
	xpStagesPaid: { type: [String], default: [] },
	xpEarned: { type: Number, default: 0 },
	// TRUST reward eligibility (see utils/campaignRewards.ts): granted once their Nexura score
	// meets the project's minimum. It reserves no place: places go first come, first served
	trustEligible: { type: Boolean, default: false },
	trustEligibleAt: { type: Date, default: null },
	trustRewardClaimed: { type: Boolean, default: false },
	// Last check, for showing the person their own progress
	rewardCheck: {
		required: { type: Number, default: null },
		current: { type: Number, default: null },
		checkedAt: { type: Date, default: null },
	},
}, { timestamps: true });

export const campaignCompleted = mongoose.model(
	"completed-campaigns",
	campaignCompletedSchema
);
