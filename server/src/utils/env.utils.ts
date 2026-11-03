import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

export const port = process.env.PORT || "5600";
export const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY as string;
export const DB_URI = process.env.DB_URI as string;
export const environment = process.env.ENVIRONMENT as "development" | "production";
const normalizedNetwork = process.env.NETWORK?.trim().toLowerCase();
export const network: "testnet" | "mainnet" = normalizedNetwork === "mainnet" ? "mainnet" : "testnet";
export const STUDIO_FEE_CONTRACT = network === "mainnet" ? "0xF26c210FAa3a7d3cB4107F222C5d994D064DCBa6" : "0xbb8AB9bfFDf563067F849f52e8E810d0084FfEB4";
export const STREAK_RESTORE_CONTRACT = network === "mainnet" ? "0x48f4462FcbB1E6cc49D23Ff8Da58a38Adc0998a1" : "0x564885ee83Aa8565Da47F38186079cD552Cf60De";
export const STUDIO_PAYMENTS_ENABLED = process.env.STUDIO_PAYMENTS_ENABLED?.trim().toLowerCase() === "true";
export const STUDIO_CAMPAIGN_FEE = network === "mainnet" ? "1000" : "1";
export const PROXY_FEE_CONTRACT = (process.env.PROXY_FEE_CONTRACT?.trim()
  || (network === "mainnet" ? "0x2e753a81720e9F47f3b11E1f854D3B44D81280CD" : "")) as string;
export const JWT_SECRET = process.env.JWT_SECRET as string;
export const REFRESH_SECRET = process.env.REFRESH_SECRET as string;
export const DISCORD_ADMIN_HUB_CLIENT_REDIRECT_URI = process.env.DISCORD_ADMIN_HUB_CLIENT_REDIRECT_URI as string;
export const DISCORD_ADMIN_HUB_REDIRECT_URI = process.env.DISCORD_ADMIN_HUB_REDIRECT_URI as string;

export const CLIENT_URL = process.env.CLIENT_URL as string;

export const COOLIFY_REDIS = process.env.COOLIFY_REDIS as string;
export const REDIS_URI = process.env.REDIS_URI as string;
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD as string;
export const REDIS_PORT = process.env.REDIS_PORT as string;
export const REDIS_USERNAME = process.env.REDIS_USERNAME as string;

export const ADMIN_URL = process.env.AUTH_URL as string;

export const SERVER_ENV = z
  .object({
    ALLOWED_ORIGINS: z
      .string()
      .transform((value) => value.split(",").map((origin) => origin.trim()))
      .refine(
        (urls) =>
          urls.every((url) => {
            try {
              new URL(url);
              return true;
            } catch {
              return false;
            }
          }),
        { message: "One or more ALLOWED_ORIGINS are invalid URLs" },
      ),
  })
  .parse(process.env);

export function trustedOrigin(requested: unknown, fallback: string): string {
  if (typeof requested !== "string") return fallback;
  try {
    const origin = new URL(requested).origin;
    return SERVER_ENV.ALLOWED_ORIGINS.some((allowed) => new URL(allowed).origin === origin) ? origin : fallback;
  } catch {
    return fallback;
  }
}

export const IPAPI_TOKEN = process.env.IPAPI_TOKEN as string;
export const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
export const AWS_REGION = process.env.AWS_REGION as string;
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY as string;
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID as string;
export const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET as string;

export const EMAIL_USER = process.env.EMAIL_USER as string;
export const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD as string;
export const SMTP_HOST = process.env.SMTP_HOST as string | undefined;
export const SMTP_PORT = process.env.SMTP_PORT as string | undefined;
export const SMTP_SECURE = process.env.SMTP_SECURE as string | undefined;
// Optional: send invites through Resend's HTTPS API, for hosts that block outbound SMTP
export const RESEND_API_KEY = process.env.RESEND_API_KEY as string | undefined;
export const RESEND_FROM = process.env.RESEND_FROM as string | undefined;

export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID as string;

export const MAIN_DISCORD_REDIRECT_URI = process.env.MAIN_DISCORD_REDIRECT_URI as string;
export const DEV_DISCORD_REDIRECT_URI = process.env.DEV_DISCORD_REDIRECT_URI as string;

const withFallback = (value: string | undefined, fallback: string) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
};

const deriveHubRedirect = (value: string | undefined, fallback: string) =>
  withFallback(value, fallback).replace("/api/auth/discord/callback", "/api/hub/discord/callback");

const deriveHubClientRedirect = (value: string | undefined, fallback: string) =>
  withFallback(value, fallback).replace("/discord/callback", "/studio-dashboard/connected-discord");

const DEV_DISCORD_HUB_CLIENT_REDIRECT_URI = deriveHubClientRedirect(
  process.env.DEV_DISCORD_HUB_CLIENT_REDIRECT_URI,
  process.env.DEV_DISCORD_CLIENT_REDIRECT_URI || "http://localhost:5173/discord/callback"
);
const MAIN_DISCORD_HUB_CLIENT_REDIRECT_URI = deriveHubClientRedirect(
  process.env.MAIN_DISCORD_HUB_CLIENT_REDIRECT_URI,
  process.env.MAIN_DISCORD_CLIENT_REDIRECT_URI || "https://nexura.intuition.box/discord/callback"
);

const DEV_DISCORD_HUB_REDIRECT_URI = deriveHubRedirect(
  process.env.DEV_DISCORD_HUB_REDIRECT_URI,
  DEV_DISCORD_REDIRECT_URI || "http://localhost:5600/api/auth/discord/callback"
);
const MAIN_DISCORD_HUB_REDIRECT_URI = deriveHubRedirect(
  process.env.MAIN_DISCORD_HUB_REDIRECT_URI,
  MAIN_DISCORD_REDIRECT_URI || "https://api.nexura.intuition.box/api/auth/discord/callback"
);

export const MAIN_DISCORD_CLIENT_REDIRECT_URI = process.env.MAIN_DISCORD_CLIENT_REDIRECT_URI as string;
export const DEV_DISCORD_CLIENT_REDIRECT_URI = process.env.DEV_DISCORD_CLIENT_REDIRECT_URI as string;

export const MAIN_X_CLIENT_REDIRECT_URI = process.env.MAIN_X_CLIENT_REDIRECT_URI as string;
export const DEV_X_CLIENT_REDIRECT_URI = process.env.DEV_X_CLIENT_REDIRECT_URI as string;

// Admin dashboard Discord OAuth — follows same derive pattern as hub
const deriveAdminClientConnected = (value: string | undefined, fallback: string) =>
  withFallback(value, fallback).replace("/discord/callback", "/discord-connected");

export const MAIN_ADMIN_DISCORD_REDIRECT_URI = process.env.MAIN_ADMIN_DISCORD_REDIRECT_URI || "https://staging-api.nexura.intuition.box/api/admin/discord/callback";
export const DEV_ADMIN_DISCORD_REDIRECT_URI = process.env.DEV_ADMIN_DISCORD_REDIRECT_URI || "http://localhost:5600/api/admin/discord/callback";

const DEV_ADMIN_DISCORD_CLIENT_CONNECTED_URI = deriveAdminClientConnected(
  process.env.DEV_ADMIN_DISCORD_HUB_CLIENT_REDIRECT_URI,
  process.env.DEV_ADMIN_DISCORD_CLIENT_REDIRECT_URI || "http://localhost:5174/discord/callback"
);
const MAIN_ADMIN_DISCORD_CLIENT_CONNECTED_URI = deriveAdminClientConnected(
  process.env.MAIN_ADMIN_DISCORD_HUB_CLIENT_REDIRECT_URI,
  process.env.MAIN_ADMIN_DISCORD_CLIENT_REDIRECT_URI || (ADMIN_URL ? ADMIN_URL + "/discord/callback" : "")
);

export const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET as string;

export const X_API_BEARER_TOKEN = process.env.X_API_BEARER_TOKEN as string;
export const X_API_CLIENT_ID = process.env.X_API_CLIENT_ID as string;
export const X_API_CLIENT_SECRET = process.env.X_API_CLIENT_SECRET as string;
export const X_API_KEY = process.env.X_API_KEY as string;
export const X_API_KEY_SECRET = process.env.X_API_KEY_SECRET as string;
export const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN as string;
export const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET as string;

export const BOT_TOKEN = process.env.BOT_TOKEN as string;

export const DISCORD_REDIRECT_URI = environment === "development" ? DEV_DISCORD_REDIRECT_URI : MAIN_DISCORD_REDIRECT_URI;
export const DISCORD_CLIENT_REDIRECT_URI = environment === "development" ? DEV_DISCORD_CLIENT_REDIRECT_URI : MAIN_DISCORD_CLIENT_REDIRECT_URI;

export const X_REDIRECT_URI = process.env.X_REDIRECT_URI as string;

export const DISCORD_HUB_REDIRECT_URI = environment === "development" ? DEV_DISCORD_HUB_REDIRECT_URI : MAIN_DISCORD_HUB_REDIRECT_URI;
export const DISCORD_HUB_CLIENT_REDIRECT_URI = environment === "development" ? DEV_DISCORD_HUB_CLIENT_REDIRECT_URI : MAIN_DISCORD_HUB_CLIENT_REDIRECT_URI;

export const ADMIN_DISCORD_REDIRECT_URI = environment === "development" ? DEV_ADMIN_DISCORD_REDIRECT_URI : MAIN_ADMIN_DISCORD_REDIRECT_URI;
export const ADMIN_DISCORD_CLIENT_REDIRECT_URI = environment === "development" ? DEV_ADMIN_DISCORD_CLIENT_CONNECTED_URI : MAIN_ADMIN_DISCORD_CLIENT_CONNECTED_URI;

export const X_CLIENT_REDIRECT_URI = environment === "development" ? DEV_X_CLIENT_REDIRECT_URI : MAIN_X_CLIENT_REDIRECT_URI;

export const THIRD_PARTY_API_KEY = process.env.THIRD_PARTY_API_KEY as string;

export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME as string;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY as string;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET as string;
