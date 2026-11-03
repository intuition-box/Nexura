import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { BACKEND_URL } from "./constants";
import { toUserFriendlyErrorMessage } from "./errorMessages";
import { resilientFetch } from "@/lib/resilientFetch";

export const buildUrl = (path: string) =>  {
  const base = (BACKEND_URL || "").replace(/\/+$/g, "");
  return `${base}${path}`;
}


async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const payload = await res.json().catch(() => ({} as Record<string, unknown>));
    const text = (payload as any).error || (payload as any).message || res.statusText;
    throw new Error(toUserFriendlyErrorMessage(text));
  }
}

export function getStoredAccessToken() {
  try {
    return localStorage.getItem("nexura:token");
  } catch (e) {
    return null;
  }
}

function buildAuthHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = extra ? { ...extra } : {};
  const token = getStoredAccessToken();
  // Only a real sign-in identifies the person (the server no longer accepts a wallet address instead)
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const fullUrl = buildUrl(url);

  const headers = buildAuthHeaders(data ? { "Content-Type": "application/json" } : {});

  console.log(`[API] → ${method} ${url}`);
  try {
    const res = await resilientFetch(fullUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    await throwIfResNotOk(res);
    console.log(`[API] ✓ ${method} ${url}`, res.status);
    return res;
  } catch (err) {
    console.error(`[API] ✗ ${method} ${url}`, err);
    throw err;
  }
}

export async function apiRequestV2(
  method: string,
  endpoint: string,
  data?: unknown | null,
): Promise<any> {
  const isFormData = data instanceof FormData;
  const headers = buildAuthHeaders(
    isFormData ? {} : { "Content-Type": "application/json" }
  );

  console.log(`[API] → ${method} ${endpoint}`);
  try {
    const res = await resilientFetch(`${BACKEND_URL || ""}${endpoint}`, {
      method,
      headers,
      body: isFormData ? data : data ? JSON.stringify(data) : undefined,
    });

    await throwIfResNotOk(res);
    const json = await res.json();
    console.log(`[API] ✓ ${method} ${endpoint}`);
    return json;
  } catch (err) {
    console.error(`[API] ✗ ${method} ${endpoint}`, err);
    throw err;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const path = (queryKey as string[]).join("/");
    const headers = buildAuthHeaders();
    const res = await resilientFetch(buildUrl(path), { headers });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

