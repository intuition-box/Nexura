import { createHash } from "crypto";
import { verifyMessage, isAddress, type Hex } from "viem";
import logger from "@/config/logger";
import { usedLoginSignature } from "@/models/usedLoginSignature.model";
import { getPublicClient } from "@/utils/account";

/*
 * Wallet sign-in proof. The app has the wallet sign:
 *   Nexura Wallet Login
 *   Address: <address>
 *   Nonce: <milliseconds since 1970>
 * and the server only signs someone in when that message is for the address they claim, was signed
 * in the last 30 minutes, really comes from that wallet, and hasn't been used to sign in before.
 */
const MAX_AGE_MS = 30 * 60 * 1000;
const CLOCK_SKEW_MS = 2 * 60 * 1000;
const LOGIN_MESSAGE = /^Nexura Wallet Login\nAddress: (0x[0-9a-fA-F]{40})\nNonce: (\d{10,16})$/;

/** Why the sign-in proof isn't accepted (in words for the person), or null when it is. */
export async function walletLoginProblem(address: unknown, message: unknown, signature: unknown): Promise<string | null> {
  if (typeof address !== "string" || !isAddress(address)) return "send a valid wallet address";
  if (typeof message !== "string" || typeof signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(signature)) {
    return "sign the login message with your wallet to sign in";
  }
  const m = LOGIN_MESSAGE.exec(message.replace(/\r\n/g, "\n"));
  if (!m) return "the login message isn't in the expected format; try signing in again";
  if (m[1]!.toLowerCase() !== address.toLowerCase()) return "the login message is for a different wallet";
  const signedAt = Number(m[2]);
  const now = Date.now();
  if (!Number.isFinite(signedAt) || signedAt > now + CLOCK_SKEW_MS || now - signedAt > MAX_AGE_MS) {
    return "this login signature has expired; sign in again";
  }

  // Ordinary wallets first; then smart-contract wallets (ERC-1271), checked on-chain
  let valid = false;
  try {
    valid = await verifyMessage({ address: address as Hex, message, signature: signature as Hex });
  } catch { /* not an ordinary wallet signature */ }
  if (!valid) {
    try {
      valid = await getPublicClient().verifyMessage({ address: address as Hex, message, signature: signature as Hex });
    } catch (err) {
      logger.warn(`wallet login: smart-wallet check failed for ${address}: ${(err as any)?.message ?? err}`);
    }
  }
  if (!valid) return "the signature doesn't match this wallet";

  // Each login message signs in once. Keyed on the message (address + time), not the signature:
  // a signature can be re-encoded into a second valid form, but the message can't change
  const hash = createHash("sha256").update(`${address.toLowerCase()}|${m[2]}`).digest("hex");
  try {
    await usedLoginSignature.create({ _id: hash, hash, expiresAt: new Date(signedAt + MAX_AGE_MS + CLOCK_SKEW_MS) });
  } catch (err: any) {
    if (err?.code === 11000) return "this login signature was already used; sign in again";
    throw err;
  }
  return null;
}
