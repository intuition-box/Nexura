import { BACKEND_URL } from "./constants";
import { toUserFriendlyErrorMessage } from "./errorMessages";
import { resilientFetch } from "@/lib/resilientFetch";

const PROJECT_API_URL = (BACKEND_URL ?? "") as string;

function getApiUrl(path: string) {
  return `${PROJECT_API_URL}/api${path}`;
}

import { getStoredUserToken, clearUserSession, getStoredUserSession } from "./userSession";

export function getStoredProjectToken(): string | null {
  try {
    const projToken = localStorage.getItem("nexura-project:token") ?? localStorage.getItem("nexura:proj-token");
    if (projToken) return projToken;
    
    // Only fallback to user token if it's a Hub session
    const userSession = getStoredUserSession();
    if (userSession?.token && userSession?.hub) {
      return userSession.token;
    }

    return null;
  } catch {
    return null;
  }
}

export function getStoredProjectInfo(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem("nexura-project:info");
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// ─── "Keep me signed in" ─────────────────────────────────────────────────────
const SESSION_ONLY_KEY = "nexura-project:session-only";
const ALIVE_COOKIE = "nexura-studio-alive";

function browserSessionAlive(): boolean {
  try { return document.cookie.split("; ").includes(`${ALIVE_COOKIE}=1`); } catch { return false; }
}

function setBrowserSessionCookie(on: boolean) {
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ALIVE_COOKIE}=${on ? "1" : ""}; Path=/; SameSite=Strict${on ? "" : "; Max-Age=0"}${secure}`;
  } catch { /* cookies unavailable */ }
}

if (typeof window !== "undefined") {
  try {
    if (localStorage.getItem(SESSION_ONLY_KEY) && !browserSessionAlive()) {
      for (const k of ["nexura-project:token", "nexura-project:info", "nexura:proj-token", SESSION_ONLY_KEY]) localStorage.removeItem(k);
    }
  } catch { /* storage unavailable */ }
}

export function storeProjectSession(token: string, info: Record<string, unknown>, remember?: boolean) {
  localStorage.setItem("nexura-project:token", token);
  localStorage.setItem("nexura-project:info", JSON.stringify(info));
  if (remember === true) {
    localStorage.removeItem(SESSION_ONLY_KEY);
    setBrowserSessionCookie(false);
  } else if (remember === false) {
    setBrowserSessionCookie(true);
    if (browserSessionAlive()) localStorage.setItem(SESSION_ONLY_KEY, "1");
  }
  notifySessionChanged();
}

// ─── Session expiry ──────────────────────────────────────────────────────────
/** Fired when the studio session starts, ends or expires, so the header can update. */
export const PROJECT_SESSION_EVENT = "nexura-project-session";
// The token the server last refused as expired or invalid
const EXPIRED_TOKEN_KEY = "nexura-project:expired-token";

function notifySessionChanged() {
  try { window.dispatchEvent(new Event(PROJECT_SESSION_EVENT)); } catch {}
}

/** Expiry time (ms) from a JWT, or null when the token has none or can't be read. */
function tokenExpiry(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json?.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True only while there is a studio token that hasn't expired and the server hasn't refused. */
export function isProjectSessionActive(): boolean {
  const token = getStoredProjectToken();
  if (!token) return false;
  try { if (localStorage.getItem(EXPIRED_TOKEN_KEY) === token) return false; } catch { /* ignore */ }
  const exp = tokenExpiry(token);
  return exp === null || exp > Date.now();
}

/** Marks the current token as no longer valid (the server said it expired). */
function markProjectSessionExpired() {
  const token = getStoredProjectToken();
  if (!token) return;
  try { localStorage.setItem(EXPIRED_TOKEN_KEY, token); } catch { /* ignore */ }
  notifySessionChanged();
}

export function clearProjectSession() {
  localStorage.removeItem("nexura-project:token");
  localStorage.removeItem("nexura-project:info");
  localStorage.removeItem("nexura:proj-token");
  localStorage.removeItem("nexura:studio-wallet");
  localStorage.removeItem("nexura:studio-step");
  localStorage.removeItem("nexura:studio-discord-return");
  localStorage.removeItem(EXPIRED_TOKEN_KEY);
  localStorage.removeItem(SESSION_ONLY_KEY);
  setBrowserSessionCookie(false);
  localStorage.removeItem("hubData");
  localStorage.removeItem("twitterData");
  clearUserSession();
  notifySessionChanged();
}

export async function endProjectSession() {
  if (!getStoredProjectToken()) return;
  try { await projectApiRequest({ method: "POST", endpoint: "/hub/logout" }); } catch { /* ignore */ }
  clearProjectSession();
}

export function isProjectSignedIn(): boolean {
  // Email/password session or Hub session
  if (getStoredProjectToken()) return true;

  // Wallet-based org session (set by use-wallet org-signin path)
  try { if (localStorage.getItem("nexura:proj-token")) return true; } catch { /* ignore */ }
  
  // Wallet-based studio session started via BuilderPopup (project mode)
  try { if (localStorage.getItem("nexura:studio-wallet")) return true; } catch { /* ignore */ }

  return false;
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const msg =
      (json as Record<string, unknown>)?.error ??
      (json as Record<string, unknown>)?.message ??
      res.statusText;

    // The server refuses an expired or invalid token: the session is over until they sign in again
    if ((res.status === 400 || res.status === 401) && /token has expired|kindly re-?login|authorization token is missing or invalid/i.test(String(msg))) {
      markProjectSessionExpired();
    }

    // Removed from the hub by an approved proposal: the session ends right away
    if (String(msg).includes("access to this hub has been removed")) {
      clearProjectSession();
      try { sessionStorage.setItem("nexura:signed-out-reason", "Your access to this hub was removed."); } catch { /* ignore */ }
      setTimeout(() => { window.location.href = "/studio/sign-in"; }, 100);
    }

    // Force logout if hub is banned
    if (res.status === 403 && String(msg).includes("this hub has been banned")) {
      clearProjectSession();
      setTimeout(() => { window.location.href = "/studio/sign-in"; }, 100);
    }

    throw new ApiError(toUserFriendlyErrorMessage(String(msg)), res.status);
  }
}

/** Error from a project API call that also carries the HTTP status. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Fired after every successful Studio change, so open pages reload their data right away. */
export const STUDIO_DATA_EVENT = "nexura-studio-data-changed";
// Saves that don't change what other pages show (builder autosave, marking notifications read)
const SILENT_CHANGES = ["/hub/save-campaign", "/hub/upload-campaign-cover", "/hub/governance/notifications/read"];

export const projectApiRequest = async <T = unknown>({
  method,
  endpoint,
  data,
  formData,
  params,
}: {
  method: string;
  endpoint: string;
  data?: unknown;
  formData?: FormData;
  params?: Record<string, string>;
}): Promise<T> => {
  const token = getStoredProjectToken();

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!formData) headers["Content-Type"] = "application/json";

  let url = getApiUrl(endpoint);
  if (params && Object.keys(params).length > 0) {
    url += `?${new URLSearchParams(params).toString()}`;
  }

  console.log(`[API:project] → ${method} ${endpoint}`);
  try {
    const res = await resilientFetch(url, {
      method,
      headers,
      body: formData ?? (data !== undefined ? JSON.stringify(data) : undefined),
    });

    await throwIfNotOk(res);

    const json = await res.json().catch(() => ({}));

    const rawHeader =
      res.headers.get("authorization") ??
      res.headers.get("x-access-token") ??
      res.headers.get("token");
    const headerToken = rawHeader?.startsWith("Bearer ")
      ? rawHeader.slice(7)
      : (rawHeader ?? null);

    console.log(`[API:project] ✓ ${method} ${endpoint}`);
    if (method.toUpperCase() !== "GET" && !SILENT_CHANGES.some(e => endpoint.startsWith(e))) {
      try { window.dispatchEvent(new Event(STUDIO_DATA_EVENT)); } catch {}
    }
    return {
      ...(typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {}),
      token:
        (json as Record<string, unknown>)?.accessToken ??
        headerToken ??
        undefined,
    } as T;
  } catch (err) {
    console.error(`[API:project] ✗ ${method} ${endpoint}`, err);
    throw err;
  }
};

export function base64ToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(";base64,");
  const contentType = meta.split(":")[1] ?? "image/png";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}
