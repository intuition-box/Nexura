import mongoose from "mongoose";
import { createHash } from "crypto";
import { REDIS } from "@/utils/redis.utils";

const TTL_SECONDS = 7 * 24 * 60 * 60;

const revokedTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, default: () => new Date(Date.now() + TTL_SECONDS * 1000), expires: 0 },
});

const revokedToken = mongoose.model("revoked-tokens", revokedTokenSchema);

const hashOf = (token: string) => createHash("sha256").update(token).digest("hex");

export async function revokeToken(token: string) {
  await Promise.allSettled([
    REDIS.set({ key: `logout:${token}`, data: { token }, ttl: TTL_SECONDS }),
    revokedToken.updateOne({ tokenHash: hashOf(token) }, { $setOnInsert: { tokenHash: hashOf(token) } }, { upsert: true }),
  ]);
}

export async function isTokenRevoked(token: string): Promise<boolean> {
  try {
    if (await REDIS.get(`logout:${token}`)) return true;
  } catch { /* Redis down: Mongo below */ }
  return !!(await revokedToken.exists({ tokenHash: hashOf(token) }));
}
