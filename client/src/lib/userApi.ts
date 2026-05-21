import { BACKEND_URL } from "./constants";
import { toUserFriendlyErrorMessage } from "./errorMessages";

const USER_API_URL = (BACKEND_URL ?? "") as string;

function getApiUrl(path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${USER_API_URL}/api${cleanPath}`;
}

export function getStoredUserToken(): string | null {
  try {
    const raw = localStorage.getItem("nexura_user_session");
    const session = raw ? JSON.parse(raw) : null;
    return session?.token || null;
  } catch {
    return null;
  }
}

export function getStoredUserInfo(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem("nexura_user_session");
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function storeUserSession(token: string, info: Record<string, unknown>) {
  localStorage.setItem("nexura_user_session", JSON.stringify({ ...info, token }));
}

export function clearUserSession() {
  localStorage.removeItem("nexura_user_session");
}

export function isUserSignedIn(): boolean {
  return !!getStoredUserToken();
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
      clearUserSession();
      // Schedule redirect to avoid React state conflicts
      setTimeout(() => { window.location.href = "/studio/users/user-signin"; }, 100);
    }

    throw new Error(toUserFriendlyErrorMessage(String(msg)));
  }
}

export const userApiRequest = async <T = unknown>({
  method,
  endpoint,
  data,
  formData,
  params,
  token: tokenOverride,
}: {
  method: string;
  endpoint: string;
  data?: unknown;
  formData?: FormData;
  params?: Record<string, string>;
  token?: string;
}): Promise<T> => {
  const token = tokenOverride || getStoredUserToken();

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
