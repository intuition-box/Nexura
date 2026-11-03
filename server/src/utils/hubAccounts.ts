import bcrypt from "bcrypt";
import logger from "@/config/logger";
import { hub, hubAdmin } from "@/models/hub.model";

/*
 * Studio accounts: each with its own password, wallet and 2FA. A username is unique inside a hub
 * but may repeat across hubs.
 * Signing in, the password picks the account; when the same password opens several, the person picks
 * the project.
 */

export const USERNAME_RULE = /^[a-zA-Z0-9_.]{3,30}$/;

const CASELESS = { locale: "en", strength: 2 } as const;

/** Whether this username is already used in that hub (by someone other than exceptId). */
export async function usernameTaken(name: string, hubId: unknown, exceptId?: string) {
  if (!hubId) return false;
  const found = await hubAdmin.findOne({ name, hub: hubId, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .collation(CASELESS).select("_id").lean();
  return !!found;
}

export const IN_ANOTHER_STUDIO = "This person is already on another studio's team and can't be invited.";

export async function inAnotherStudio(email: string, hubId: unknown) {
  return !!(await hubAdmin.exists({ email: email.trim().toLowerCase(), hub: { $ne: hubId } }));
}

export type HubChoice = { accountId: string; name: string; logo: string };

/** The accounts this email or username plus password open. */
export async function accountsForLogin(identifier: string, password: string): Promise<any[]> {
  const id = identifier.trim();
  if (!id || !password) return [];
  const query = id.includes("@") ? { email: id.toLowerCase() } : { name: id };
  const candidates = await hubAdmin.find(query).collation(CASELESS).limit(50).lean();
  const matches: any[] = [];
  for (const a of candidates) {
    if (await bcrypt.compare(password, (a as any).password)) matches.push(a);
  }
  return matches;
}

/** The projects behind these accounts, for the person to pick from. */
export async function hubChoices(accounts: any[]): Promise<HubChoice[]> {
  const hubs = await hub.find({ _id: { $in: accounts.map(a => a.hub).filter(Boolean) } }).select("name logo").lean() as any[];
  const byId = new Map(hubs.map(h => [String(h._id), h]));
  return accounts.map(a => {
    const h = a.hub ? byId.get(String(a.hub)) : null;
    return { accountId: String(a._id), name: h?.name ?? "Studio not set up yet", logo: h?.logo ?? "" };
  });
}

/** The accounts on this email, newest first. */
export const accountsForEmail = (email: string) =>
  hubAdmin.find({ email: email.trim().toLowerCase() }).sort({ createdAt: -1 });

/** Older databases have a unique index on hub-admin email; drop it so an email can join more hubs. */
export async function allowSharedHubEmails() {
  try {
    const indexes = await hubAdmin.collection.indexes();
    const emailIndex = indexes.find(i => i.unique && Object.keys(i.key ?? {}).join(",") === "email");
    if (emailIndex?.name) {
      await hubAdmin.collection.dropIndex(emailIndex.name);
      logger.info(`hub-admins: dropped unique email index ${emailIndex.name}`);
    }
  } catch (err) {
    logger.warn(`hub-admins: couldn't check the email index: ${(err as Error)?.message ?? err}`);
  }
}
