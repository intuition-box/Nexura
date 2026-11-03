import mongoose from "mongoose";

const retentionDraftSchema = new mongoose.Schema({
  adminId: {
    type: String,
    required: true,
    unique: true,
  },
  draft: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export const retentionDraft = mongoose.model("retention-drafts", retentionDraftSchema);
