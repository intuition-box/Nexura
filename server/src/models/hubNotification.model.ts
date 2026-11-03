import mongoose, { Schema } from "mongoose";

/** Notices for a hub's admins about changes that don't go through proposals (project settings). */
const hubNotificationSchema = new Schema({
  hub: { type: Schema.Types.ObjectId, ref: "hubs", required: true, index: true },
  kind: { type: String, enum: ["project", "username", "campaign"], required: true },
  actor: { type: Schema.Types.ObjectId, ref: "hub-admins" },
  actorName: { type: String, default: "" },
  // What changed, in words ("website", "X account" …)
  changes: [{ type: String }],
  details: [{ _id: false, field: String, from: { type: String, default: "" }, to: { type: String, default: "" } }],
  // Where the notice opens
  tab: { type: String, enum: ["project", "accounts"], default: "project" },
  recipients: [{ type: Schema.Types.ObjectId, ref: "hub-admins", index: true }],
  readBy: [{ type: Schema.Types.ObjectId, ref: "hub-admins" }],
  // Removed after 90 days
  expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), expires: 0 },
}, { timestamps: true });

export const hubNotification = mongoose.model("hub-notifications", hubNotificationSchema);
