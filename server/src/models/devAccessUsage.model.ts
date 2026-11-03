import mongoose from "mongoose";

// One row per tester per day (UTC) of test app use, so the dashboard can show time spent and trends
const devAccessUsageSchema = new mongoose.Schema({
  address: { type: String, required: true, lowercase: true, trim: true },
  day: { type: String, required: true }, // YYYY-MM-DD
  activeMinutes: { type: Number, default: 0 },
  visits: { type: Number, default: 0 },
  pages: { type: Map, of: Number, default: {} },
  actions: { type: Map, of: Number, default: {} },
}, { timestamps: true });

devAccessUsageSchema.index({ address: 1, day: 1 }, { unique: true });

export const devAccessUsage = mongoose.model("dev-access-usage", devAccessUsageSchema);
