import mongoose, { Schema } from "mongoose";

const ecosystemQuestSchema = new Schema({
	name: {
		type: String,
		required: true,
	},
	description: {
		type: String,
		required: true,
	},
	logo: {
		type: String,
		required: true,
  },
	reward: {
		type: Number,
		required: true
	},
	websiteUrl: {
		type: String,
		required: true,
	},
	category: {
		type: String,
		required: false,
		default: "quests",
		enum: [
			"defi",
			"lending protocols",
			"prediction markets",
			"nft",
			"infrastructure",
			"identity",
			"reputation",
			"quests",
			"browser extension",
			"ai",
			"social",
			"gaming",
			"tools",
			"portal",
			"domain name",
			"launchpads",
		],
	},
}, { timestamps: true });

export const ecosystemQuest = mongoose.model(
	"ecosystem-quests",
	ecosystemQuestSchema
);

const campaignQuestSchema = new Schema({
	quest: {
		type: String,
		required: true,
	},
	category: {
		type: String,
		enum: ["twitter", "discord", "reddit", "instagram", "facebook", "other"],
		required: true,
	},
	tag: {
		type: String,
		enum: ["like", "follow", "follow-x", "trust-name", "repost", "repost-x", "join", "join-discord", "portal", "message", "message-discord", "acquire-role-discord", "send-message-discord", "comment", "comment-x", "feedback", "create-post", "other"],
		required: true
	},
	followers: {
		type: Number
	},
	guildId: {
		type: String
	},
	roleId: {
		type: String
	},
	channelId: {
		type: String
	},
	link: {
		type: String,
		required: true
	},
	feedbackCharLimit: {
		type: Number,
		required: false,
	},
	campaign: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "campaign",
	},
}, { timestamps: true });

export const campaignQuest = mongoose.model(
	"campaign-quest",
	campaignQuestSchema
);

const questSchema = new Schema({
	title: {
		type: String,
		required: true
  },
  project_image: {
    type: String,
    default: ""
  },
  participants: {
    type: Number,
    default: 0
  },
  project_name: {
    type: String,
    default: ""
  },
  projectCoverImage: {
    type: String,
    required: true
  },
	sub_title: {
		type: String
	},
	noOfQuests: {
		type: Number,
		default: 0
  },
  starts_at: {
    type: String,
    required: true
  },
  ends_at: {
    type: String,
    required: true
	},
	description: {
		type: String,
		required: true
	},
	tag: {
		type: String
	},
	status: {
		type: String,
		enum: ["Active", "Scheduled", "Save", "Ended", "Deleted"],
		default: "Save"
	},
	deletedAt: {
		type: Date,
		default: null,
	},
	questNumber: {
		type: Number
	},
	reward: {
		type: Number,
		default: 200,
	},
	link: {
		type: String,
  },
  creator: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'creatorModel',
  },
  creatorModel: {
    type: String,
    required: true,
    enum: ['user', 'admin'],
  },
  hub: {
    type: Schema.Types.ObjectId,
    ref: 'user-hubs',
  }
}, { timestamps: true });

export const quest = mongoose.model("quests", questSchema);

const miniQuestSchema = new Schema({
	text: {
		type: String,
		default: ""
	},
	guildId: {
		type: String
	},
	roleId: {
		type: String
	},
	channelId: {
		type: String
	},
	verificationMode: {
		type: String
	},
	category: {
		type: String,
		enum: ["twitter", "discord", "reddit", "instagram", "facebook", "other"],
	},
	tag: {
		type: String,
		enum: ["like", "follow", "follow-x", "message", "message-discord", "other", "portal", "comment", "comment-x", "repost", "repost-x", "join", "join-discord", "acquire-role-discord", "send-message-discord", "feedback", "trust-name", "create-post"]
	},
	link: {
		type: String
	},
	quest: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "quest",
	}
}, { timestamps: true });

export const miniQuest = mongoose.model("mini-quests", miniQuestSchema);
