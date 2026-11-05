import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema({
  submissionLink: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "retry", "done", "banned"],
    default: "pending"
  },
  page: {
    type: String,
    required: true
  },
  address: {
    type: String,
  },
  taskType: {
    type: String,
    required: true,
  },
  validatedBy: {
    type: String,
  },
  username: {
    type: String,
    default: ""
  },
  miniQuestId: {
    type: String,
    required: true
  },
  questCompleted: {
    type: String,
    default: ""
  },
  category: {
    type: String,
    enum: ["seasonal", "featured", "daily"],
    required: false
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true
  },
  hub: {
    type: String,
    required: true
  },
  rejectedCount: {
    type: Number,
    default: 0
  },
  reviewedAt: {
    type: Date,
  },
  reviewNote: {
    type: String,
    default: ""
  },
}, { timestamps: true });

export const submission = mongoose.model("submissions", submissionSchema);
