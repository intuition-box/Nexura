import { DEV_ACCESS_ON } from "./devAccess";

/**
 * Nexura Studio is open on the private test app, on localhost, or wherever NEXT_PUBLIC_STUDIO_LIVE
 * is "true". Everywhere else (the main app) it shows that it's being upgraded.
 */
export function isStudioLive(): boolean {
  if (DEV_ACCESS_ON || process.env.NEXT_PUBLIC_STUDIO_LIVE === "true") return true;
  return typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
}

/** Pages that belong to Nexura Studio (not the user dashboard that shares its layout). */
export const isStudioPath = (path: string) =>
  path === "/studio" || path.startsWith("/studio/") || path.startsWith("/studio-dashboard")
  || path.startsWith("/projects/create") || path.startsWith("/connect-discord") || path.startsWith("/project/connected-discord");
