import mongoose, { Schema } from "mongoose";

const hubSchema = new Schema({
  systemKey: {
    type: String,
    unique: true,
    sparse: true,
  },
  name: {
    type: String,
    required: true,
    unique: true
  },
  discordConnected: {
    type: Boolean,
    default: false
  },
  // A Discord server may be linked to multiple hubs (different projects/studios
  // can share the same community). Indices are kept sparse so disconnected
  // hubs don't participate. NOT unique.
  guildId: {
    type: String,
    sparse: true,
    index: true,
  },
  verifiedId: {
    type: String,
    sparse: true,
    index: true,
  },
  logo: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: false,
    default: ""
  },
  categories: {
    type: [String],
    default: []
  },
  website: {
    type: String,
    required: false,
    default: ""
  },
  xAccount: {
    type: String,
    required: false,
    default: ""
  },
  discordServer: {
    type: String,
    required: false,
    default: ""
  },
  discordSessionId: {
    type: String,
    required: false,
    default: ""
  },
  document: {
    type: String,
    required: false,
    default: ""
  },
  campaignsCreated: {
    type: Number,
    default: 0
  },
  questsCreated: {
    type: Number,
    default: 0
  },
  noOfPayments: {
    type: Number,
    default: 0
  },
  xpAllocated: {
    type: Number,
    default: 500
  },
  superAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "admins",
    required: true
  },
  pendingTxHash: {
    type: String,
    default: null,
  }
}, { timestamps: true });

export const hub = mongoose.model("hubs", hubSchema, "projects");
export const projectModel = mongoose.model("project", hubSchema, "projects");

const hubAdminSchema = new mongoose.Schema({
  // Not unique: one email can hold accounts in several hubs. The username (name) is unique instead
  email: {
    type: String,
    required: true,
    index: true,
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["superadmin", "admin"],
    required: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: Number,
  },
  hub: {
    type: Schema.Types.ObjectId,
    ref: 'hubs',
  },
  // Set by the first wallet action in the hub (see utils/hubWallet.ts); sign-in then needs this wallet
  linkedWallet: {
    type: String,
    default: null,
  },
  usernameChanges: {
    type: Number,
    default: 0,
  },
  // Google Authenticator 2-step verification (secrets are encrypted, see utils/secretBox.ts)
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  twoFactorPendingSecret: { type: String, default: null },
  twoFactorLastStep: { type: Number, default: 0 },
  pendingTxHash: {
    type: String,
    default: null,
  },
  // Last authenticated studio request, for the team's online status
  lastActiveAt: {
    type: Date,
    default: null,
  },
  // Sessions issued before this stop working (set when the password is reset)
  passwordChangedAt: {
    type: Date,
    default: null,
  }
}, { timestamps: true });

export const hubAdmin = mongoose.model("hub-admins", hubAdminSchema);

const ACTIVITY_WRITE_INTERVAL_MS = 30 * 1000;

/** Records that a studio admin is active. Writes at most every 30 seconds and never blocks the request. */
export function touchHubAdminActivity(id: string, lastActiveAt?: Date | null) {
  if (lastActiveAt && Date.now() - new Date(lastActiveAt).getTime() < ACTIVITY_WRITE_INTERVAL_MS) return;
  hubAdmin.updateOne({ _id: id }, { $set: { lastActiveAt: new Date() } }).catch(() => {});
}

const userHubSchema = new Schema({
  systemKey: {
    type: String,
    unique: true,
    sparse: true,
  },
  name: {
    type: String,
    required: true,
    unique: true
  },
  logo: {
    type: String,
    required: false
  },
  description: {
    type: String,
    required: false,
    default: ""
  },
  xAccount: {
    type: String,
    required: false,
    default: ""
  },
  questsCreated: {
    type: Number,
    default: 0
  },
  noOfPayments: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  superAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user-hub-admins",
    required: false
  },
  pendingTxHash: {
    type: String,
    default: null,
  }
}, { timestamps: true });

export const userHub = mongoose.model("user-hubs", userHubSchema);

const userHubAdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  hub: {
    type: Schema.Types.ObjectId,
    ref: 'user-hubs',
  },
  pendingTxHash: {
    type: String,
    default: null,
  }
}, { timestamps: true });

export const userHubAdmin = mongoose.model("user-hub-admins", userHubAdminSchema);