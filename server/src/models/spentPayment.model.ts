import mongoose from "mongoose";

/** On-chain payments already spent on a publish, so one transaction can't pay for two launches. */
const spentPaymentSchema = new mongoose.Schema({
  txHash: { type: String, required: true, unique: true },
  hub: { type: mongoose.Schema.Types.ObjectId, ref: "hubs" },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: "campaigns" },
}, { timestamps: true });

export const spentPayment = mongoose.model("spent-payments", spentPaymentSchema);
