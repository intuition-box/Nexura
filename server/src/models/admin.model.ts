import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String
  },
  role: {
    type: String,
    default: "admin",
    enum: ["superadmin", "admin"]
  },
  password: {
    type: String,
    required(this: { verified?: boolean }) {
      return Boolean(this.verified);
    }
  },
  verified: {
    type: Boolean,
    default: false
  },
  code: {
    type: String,
  },
  lastActivity: {
    type: Date,
    default: null
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  // Sessions and reset links issued before this stop working (set when the password changes)
  passwordChangedAt: {
    type: Date,
    default: null
  },
  // Set by the first sign-in with a wallet; afterwards only this wallet can sign in or sign proposals
  linkedWallet: {
    type: String,
    default: null
  },
  // Username edits made from My Profile (limited, as in the Studio)
  usernameChanges: {
    type: Number,
    default: 0
  },
  // Google Authenticator 2-step verification, as for Studio admins (secrets are encrypted, see utils/secretBox.ts)
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  twoFactorPendingSecret: { type: String, default: null },
  twoFactorLastStep: { type: Number, default: 0 }
}, { timestamps: true });

export const admin = mongoose.model("admin", adminSchema);
