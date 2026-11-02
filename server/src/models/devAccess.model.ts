import mongoose from "mongoose";

const devAccessSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, lowercase: true, trim: true },
  label: { type: String, default: "" },
  addedBy: { type: String, default: "" },
}, { timestamps: true });

export const devAccess = mongoose.model("dev-access", devAccessSchema);
