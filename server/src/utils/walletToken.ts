import { JWT } from "@/utils/utils";

/** One wallet signature (see walletLogin.ts) becomes this token, so later sign-ins don't ask again. */
export const WALLET_TOKEN_PURPOSE = "studio-wallet";
export const WALLET_TOKEN_TTL = "30d";

export const issueWalletToken = (address: string) => JWT.signFor(address.toLowerCase(), WALLET_TOKEN_PURPOSE, WALLET_TOKEN_TTL);

/** The wallet address a token proves, or null when it is missing, expired or forged. */
export async function walletFromToken(token: unknown): Promise<string | null> {
  if (typeof token !== "string" || !token) return null;
  try {
    const { id } = await JWT.verifyFor(token, WALLET_TOKEN_PURPOSE);
    return /^0x[0-9a-f]{40}$/.test(id) ? id : null;
  } catch { return null; }
}
