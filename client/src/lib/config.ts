import { BACKEND_URL } from "./constants";
import { resilientFetch } from "@/lib/resilientFetch";

export const API_URL = BACKEND_URL;

const getApiUrl = (path: string) => {
  // const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  // const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_URL}${path}`;
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.json()).error || res.statusText;
    throw new Error(`${text}`);
  }
}

export function getStoredAccessToken() {
  try {
    return localStorage.getItem("nexura-admin:token");
  } catch (e) {
    return null;
  }
}

export function getStoredAdminInfo() {
  try {
    const info = localStorage.getItem("nexura-admin:info");
    return info ? JSON.parse(info) : null;
  } catch (e) {
    return null;
  }
}

export const apiRequest = async <T = any>({ method, endpoint, data, formData }: {
  method: string,
  endpoint: string,
  data?: unknown | null,
  formData?: FormData
}): Promise<T> => {
  const token = getStoredAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (!formData) headers["Content-Type"] = "application/json";

  const res = await resilientFetch(getApiUrl(endpoint), {
    method,
    headers,
    body: formData ?? (data ? JSON.stringify(data) : undefined),
  });

  await throwIfResNotOk(res);

  // Read response body
  const json = await res.json().catch(() => ({}));


  const headerTokenRaw = res.headers.get("authorization") || res.headers.get("x-access-token") || res.headers.get("token");
  let headerToken: string | null = null;
  if (headerTokenRaw) {
    
    headerToken = headerTokenRaw.startsWith("Bearer ") ? headerTokenRaw.slice(7) : headerTokenRaw;
  }

  const combined = { ...(typeof json === "object" && json ? json as Record<string, unknown> : {}), token: (json && (json as any).accessToken) || headerToken } as unknown as T;
  return combined;
}