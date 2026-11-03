import mongoose from "mongoose";

const devAccessSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, default: "" },
  email: { type: String, default: "", lowercase: true, trim: true },
  addedBy: { type: String, default: "" },
  // Last time this wallet used the test app (recorded at most every few minutes)
  lastSeenAt: { type: Date, default: null },
  // Running totals of test app use; the per-day detail lives in dev-access-usage
  lastActiveAt: { type: Date, default: null },
  // When the last active minute was counted, so two open tabs never count the same minute twice
  lastMinuteAt: { type: Date, default: null },
  usage: {
    activeMinutes: { type: Number, default: 0 },
    visits: { type: Number, default: 0 },
    pageViews: { type: Number, default: 0 },
    actions: { type: Number, default: 0 },
  },
}, { timestamps: true });

export const devAccess = mongoose.model("dev-access", devAccessSchema);
