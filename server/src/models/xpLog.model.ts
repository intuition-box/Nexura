import mongoose from "mongoose";

const xpLogSchema = new mongoose.Schema({
  address: { type: String, required: true, lowercase: true },
  amount: { type: Number, required: true },
  username: {  type: String },
  status: { type: String, enum: ["success", "failed"], required: true },
  type: { type: String, enum: ["single", "batch", "quest-creation", "wotw", "contest", "spotlight", "daily-xp-streak-reward", "campaign", "referral", "ecosystem-quest", "quest", "daily-xp", "lesson", "deposit-xp"], required: true },
  timestamp: { type: Date, default: Date.now }
});

xpLogSchema.index({ address: 1, type: 1, timestamp: -1 });

export const xpLog = mongoose.model("xpLog", xpLogSchema);
