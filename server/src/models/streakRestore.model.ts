import mongoose from "mongoose";

const streakRestoreSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  address: { type: String, required: true, lowercase: true },
  username: { type: String, default: "" },
  source: { type: String, enum: ["paid", "gift"], required: true },
  scenario: { type: String, enum: ["pending", "resumed"], default: "pending" },
  bridgedDays: { type: [String], default: [] },
  missedDay: { type: String, required: true },
  countedDay: { type: String, default: null },
  fromStreak: { type: Number, required: true },
  toStreak: { type: Number, required: true },
  xp: { type: Number, default: 0 },
  txHash: { type: String, default: null },
  proposalRef: { type: String, default: null },
  proposedBy: { id: { type: String, default: null }, name: { type: String, default: "" } },
}, { timestamps: true });

streakRestoreSchema.index({ user: 1, missedDay: 1 }, { unique: true });
streakRestoreSchema.index({ user: 1, createdAt: -1 });
streakRestoreSchema.index({ createdAt: -1 });

export const streakRestore = mongoose.model("streak-restores", streakRestoreSchema);

const streakRestoreAttemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  address: { type: String, lowercase: true, default: "" },
  txHash: { type: String, default: "" },
  ok: { type: Boolean, required: true },
  status: { type: Number, default: 0 },
  reason: { type: String, default: "" },
}, { timestamps: true });

streakRestoreAttemptSchema.index({ address: 1, createdAt: -1 });

export const streakRestoreAttempt = mongoose.model("streak-restore-attempts", streakRestoreAttemptSchema);
