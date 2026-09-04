import mongoose, { Schema } from "mongoose";

const userSchema = new Schema({
	username: {
		type: String,
		required: true,
		unique: true
	},
	tier: {
		type: Number,
		default: 0,
  },
  location: {
    country: {
      type: String,
      default: "",
    },
    countryCode: {
      type: String,
      default: "",
    },
    continent: {
      type: String,
      default: "",
    },
    continentCode: {
      type: String,
      default: "",
    },    
  },
  totalCheckIns: {
    type: Number,
    default: 0
  },
  streakToRestore: {
    type: Number,
    default: 0
  },
  dayCount: {
    type: Number,
    default: 0
	},
	address: {
		type: String,
		required: true,
		unique: true
	},
	claimsSold: {
		type: Number,
		default: 0
	},
	noOfClaimsCreated: {
		type: Number,
		default: 0
	},
	noOfClaims: {
		type: Number,
		default: 0,
	},
	noOfMints: {
		type: Number,
		default: 0,
	},
	eventsWon: {
		type: Number,
		default: 0,
	},
	lessonsCompleted: {
		type: Number,
		default: 0,
	},
  isApproved: {
    type: Boolean,
    default: false
	},
	profilePic: {
		type: String,
		default: "",
  },
  dailyTrustXpDate: {
    type: String,
    default: "",
	},
	socialProfiles: {
		x: {
			connected: {
				type: Boolean,
				default: false
			},
			username: {
				type: String,
			},
			id: {
				type: String,
			},
			disconnectedAt: {
				type: Date,
			}
		},
		discord: {
			connected: {
				type: Boolean,
				default: false
			},
			username: {
				type: String,
			},
			id: {
				type: String,
			},
			disconnectedAt: {
				type: Date,
			}
		},
	},
	referralAllowed: {
		type: Boolean
	},
	email: {
		type: String,
		// required: true
	},
	level: {
		type: String,
		default: "1",
	},
	xp: {
		type: Number,
		default: 0,
	},
	badges: [{
		type: Number
	}],
	referral: {
		code: {
			type: String,
			required: true,
		},
		users: {
			type: Number,
			default: 0,
		},
		xp: {
			type: Number,
			default: 0,
		},
	},
	lastSignInDate: {
		type: String
	},
	streak: {
		type: Number,
		default: 0
	},
	longestStreak: {
		type: Number,
		default: 0
	},
	questsCompleted: {
		type: Number,
		default: 0,
  },
  hasRelic: {
    type: Boolean,
    default: false
	},
	campaignsCompleted: {
		type: Number,
		default: 0,
	},
	trustEarned: {
		type: Number,
		default: 0,
	},
	dateJoined: {
		type: String,
		required: true,
	},
	refRewardClaimed: {
		type: Boolean,
		default: false
	},
	trustName: {
		type: String,
		default: ""
	},
	status: {
		type: String,
		default: "Inactive"
	},
	campaigns: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: "campaign",
	}],
}, { timestamps: true });

userSchema.index({ xp: -1 });

export const user = mongoose.model("users", userSchema);
