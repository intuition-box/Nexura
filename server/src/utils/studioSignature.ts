import { ethers } from "ethers";

// EIP-712 data the studio client signs (must match the client)
export const SIGN_DOMAIN = { name: "Nexura Studio", version: "1" };
export const SIGN_TYPES = {
  StudioAction: [
    { name: "hub", type: "string" },
    { name: "action", type: "string" },
    { name: "proposal", type: "string" },
    { name: "proposalId", type: "string" },
    { name: "signer", type: "string" },
    { name: "signedAt", type: "string" },
  ],
};
export const SIGNATURE_MAX_AGE_MS = 10 * 60 * 1000;

// Plain-message form, for wallets that can't sign EIP-712 (must match the client)
export const studioActionText = (m: Record<string, unknown>) =>
  `Nexura Studio\nAction: ${m.action}\nHub: ${m.hub}\nSubject: ${m.proposal}\nID: ${m.proposalId}\nSigner: ${m.signer}\nSigned at: ${m.signedAt}`;

export type SignatureScheme = "typed" | "text";
export const signatureScheme = (scheme: unknown): SignatureScheme => (scheme === "text" ? "text" : "typed");

export const recoverStudioSigner = (m: Record<string, unknown>, signature: string, scheme: SignatureScheme) =>
  scheme === "text"
    ? ethers.verifyMessage(studioActionText(m), signature)
    : ethers.verifyTypedData(SIGN_DOMAIN, SIGN_TYPES, m, signature);

/**
 * Checks a studio action signature (e.g. publishing a campaign) and returns the signing wallet.
 * Throws a readable message when it's missing, stale, for something else or invalid.
 */
export function recoverStudioSignature(
  body: { signature?: unknown; message?: unknown; scheme?: unknown },
  expected: { action: string; targetId: string; adminId: string },
): string {
  const { signature, message, scheme } = body ?? {};
  if (typeof signature !== "string" || !signature.startsWith("0x")) throw new Error("a wallet signature is required");
  if (!message || typeof message !== "object") throw new Error("the signed message is required");
  const m = message as Record<string, unknown>;
  for (const f of ["hub", "action", "proposal", "proposalId", "signer", "signedAt"]) {
    if (typeof m[f] !== "string") throw new Error(`signed message is missing ${f}`);
  }
  if (m.action !== expected.action) throw new Error("the signature is for a different action");
  if (m.proposalId !== expected.targetId) throw new Error("the signature is for a different campaign");
  if (!String(m.signer).includes(`(${expected.adminId})`)) throw new Error("the signature names a different admin");
  const signedAt = new Date(String(m.signedAt));
  if (isNaN(signedAt.getTime()) || Math.abs(Date.now() - signedAt.getTime()) > SIGNATURE_MAX_AGE_MS) {
    throw new Error("the signature has expired, sign again");
  }
  try {
    return recoverStudioSigner(m, signature, signatureScheme(scheme));
  } catch {
    throw new Error("the wallet signature is not valid");
  }
}
