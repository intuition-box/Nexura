import mongoose from "mongoose";
import { open, seal } from "@/utils/secretBox";

const tokenSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  accessToken: {
    type: String,
    required: true,
    set: seal,
    get: open,
  },
  refreshToken: {
    type: String,
    required: true,
    set: seal,
    get: open,
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
}, { toJSON: { getters: true }, toObject: { getters: true } });

export const token = mongoose.model("Tokens", tokenSchema);
