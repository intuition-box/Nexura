import mongoose from "mongoose";

const devAccessSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, default: "" },
  email: { type: String, default: "", lowercase: true, trim: true },
  addedBy: { type: String, default: "" },
  // Only honoured while the email belongs to an admin of the Nexura dashboard.
  canInvite: { type: Boolean, default: false },
  // Last time this wallet used the test app (recorded at most every few minutes)
  lastSeenAt: { type: Date, default: null },
}, { timestamps: true });

export const devAccess = mongoose.model("dev-access", devAccessSchema);
