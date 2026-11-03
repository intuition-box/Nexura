import mongoose from "mongoose";
import { randomBytes } from "crypto";

const linkTicketSchema = new mongoose.Schema({
  ticket: { type: String, required: true, unique: true },
  provider: { type: String, enum: ["discord", "x"], required: true },
  accountId: { type: String, required: true },
  username: { type: String, default: "" },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000), expires: 0 },
});

export const linkTicket = mongoose.model("link-tickets", linkTicketSchema);

export async function issueLinkTicket(provider: "discord" | "x", accountId: string, username: string) {
  const ticket = randomBytes(24).toString("hex");
  await linkTicket.create({ ticket, provider, accountId: String(accountId), username: String(username ?? "") });
  return ticket;
}

export async function redeemLinkTicket(provider: "discord" | "x", ticket: unknown) {
  if (typeof ticket !== "string" || !/^[a-f0-9]{48}$/.test(ticket)) return null;
  const found = await linkTicket.findOneAndDelete({ ticket, provider, expiresAt: { $gt: new Date() } }).lean();
  return found ? { accountId: found.accountId, username: found.username } : null;
}
