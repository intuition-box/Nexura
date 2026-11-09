import mongoose, { Schema } from "mongoose";

/** Feature requests, bug reports and support tickets sent from the app and Nexura Studio. */
const replySchema = new Schema({
  from: { type: String, enum: ["team", "reporter"], required: true },
  name: { type: String, default: "" },
  message: { type: String, required: true, maxlength: 20000 },
  at: { type: Date, default: Date.now },
});

const feedbackSchema = new Schema({
  kind: { type: String, enum: ["feature", "bug", "help"], required: true },
  status: { type: String, enum: ["open", "replied", "closed"], default: "open" },
  title: { type: String, required: true, maxlength: 500 },
  details: { type: String, required: true, maxlength: 20000 },
  attachments: { type: [String], default: [] },
  page: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  source: { type: String, enum: ["app", "studio"], required: true },
  testApp: { type: Boolean, default: false },
  reporter: {
    type: { type: String, enum: ["user", "studio"], required: true },
    accountId: { type: String, required: true },
    name: { type: String, default: "" },
    wallet: { type: String, default: "" },
    hubId: { type: String, default: "" },
    hubName: { type: String, default: "" },
  },
  replies: { type: [replySchema], default: [] },
  // A team reply the reporter hasn't opened yet / a report or reply the team hasn't opened yet
  reporterUnread: { type: Boolean, default: false },
  teamUnread: { type: Boolean, default: true },
}, { timestamps: true });

feedbackSchema.index({ "reporter.type": 1, "reporter.wallet": 1, createdAt: -1 });
feedbackSchema.index({ "reporter.type": 1, "reporter.accountId": 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });

export const feedback = mongoose.model("feedback-reports", feedbackSchema);
