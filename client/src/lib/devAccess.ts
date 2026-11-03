import { BACKEND_URL } from "./constants";

export const DEV_ACCESS_ON = process.env.NEXT_PUBLIC_DEV_ACCESS === "true" || !!BACKEND_URL?.includes("staging-api.nexura.intuition.box");
export const DEV_ACCESS_HEADER = "x-dev-access";
export const DEV_ACCESS_DENIED_EVENT = "nexura:dev-access-denied";
const KEY = "nexura_dev_access";

export type DevAccessRole = { address: string };

export const getDevAccessToken = () => {
  try { return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY); } catch { return null; }
};
/** With "Keep me signed in" the pass stays for its 7 days; otherwise it ends when the browser closes. */
export const setDevAccessToken = (token: string | null, remember = true) => {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    if (token) (remember ? localStorage : sessionStorage).setItem(KEY, token);
  } catch { /* storage blocked */ }
};

const needsHeader = (url: string) =>
  (!!BACKEND_URL && url.startsWith(BACKEND_URL)) || url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);

// Told about each successful write request the test app makes, for usage tracking (lib/testAppUsage.ts)
let apiWriteListener: ((url: string) => void) | null = null;
export const onApiWrite = (fn: ((url: string) => void) | null) => { apiWriteListener = fn; };

let installed = false;
export function installDevAccessFetch() {
  if (!DEV_ACCESS_ON || installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const token = getDevAccessToken();
    if (!token || !needsHeader(url)) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(DEV_ACCESS_HEADER, token);
    const res = await original(input, { ...init, headers });
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (res.ok && method !== "GET" && method !== "HEAD") apiWriteListener?.(url);
    if (res.status === 403 && res.headers.get(DEV_ACCESS_HEADER) === "denied") {
      setDevAccessToken(null);
      window.dispatchEvent(new Event(DEV_ACCESS_DENIED_EVENT));
    }
    return res;
  };
}

installDevAccessFetch();

export const forwardDevAccess = (req: Request): Record<string, string> => {
  const token = req.headers.get(DEV_ACCESS_HEADER);
  return token ? { [DEV_ACCESS_HEADER]: token } : {};
};
