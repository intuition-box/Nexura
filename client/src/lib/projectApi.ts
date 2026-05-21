import { BACKEND_URL } from "./constants";
import { toUserFriendlyErrorMessage } from "./errorMessages";

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

export function storeProjectSession(token: string, info: Record<string, unknown>) {
  localStorage.setItem("nexura-project:token", token);
  localStorage.setItem("nexura-project:info", JSON.stringify(info));
}

export function clearProjectSession() {
  localStorage.removeItem("nexura-project:token");
  localStorage.removeItem("nexura-project:info");
  localStorage.removeItem("nexura:proj-token");
  localStorage.removeItem("nexura:studio-wallet");
  localStorage.removeItem("nexura:studio-step");
  localStorage.removeItem("nexura:studio-discord-return");
  localStorage.removeItem("hubData");
  localStorage.removeItem("twitterData");
  clearUserSession();
  // NOTE: nexura:wallet is intentionally NOT cleared here.
  // It belongs to the main app wallet connection (use-wallet.tsx),
  // not the studio/project session. Clearing it here would
  // disconnect the user's wallet when logging out of the studio.
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

    // Force logout if hub is banned
    if (res.status === 403 && String(msg).includes("this hub has been banned")) {
      clearProjectSession();
      setTimeout(() => { window.location.href = "/projects/create/signin-to-hub"; }, 100);
    }

    throw new Error(toUserFriendlyErrorMessage(String(msg)));
  }
}

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

  const res = await fetch(url, {
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

  return {
    ...(typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {}),
    token:
      (json as Record<string, unknown>)?.accessToken ??
      headerToken ??
      undefined,
  } as T;
};

export function base64ToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(";base64,");
  const contentType = meta.split(":")[1] ?? "image/png";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}
