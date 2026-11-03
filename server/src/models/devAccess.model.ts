import mongoose from "mongoose";

const devAccessSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, default: "" },
  email: { type: String, default: "", lowercase: true, trim: true },
  addedBy: { type: String, default: "" },
  // Only honoured while the email belongs to a member of the Nexura hub.
  canInvite: { type: Boolean, default: false },
}, { timestamps: true });

export const devAccess = mongoose.model("dev-access", devAccessSchema);
