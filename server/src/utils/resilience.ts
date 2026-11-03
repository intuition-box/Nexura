import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import logger from "@/config/logger";

/**
 * Timeouts and retries for every call Nexura makes to another service (Discord, X, Intuition,
 * email, storage, RPC). A slow service gives up after a fixed time instead of holding the request
 * open, and a brief failure (network blip, 429, 502/503/504) is tried again with growing waits.
 *
 * Only safe calls are retried: reads, and writes that can't happen twice (the caller says so).
 * One-time actions like exchanging an OAuth code are never retried.
 */

/** How long one outside call may take. */
export const OUTBOUND_TIMEOUT_MS = 10_000;
/** Extra tries after the first one fails for a temporary reason. */
export const DEFAULT_RETRIES = 2;

const TRANSIENT_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ECONNABORTED", "ETIMEDOUT", "ESOCKETTIMEDOUT", "EPIPE",
  "EAI_AGAIN", "ENOTFOUND", "ENETUNREACH", "EHOSTUNREACH", "ECONNECTION", "ESOCKET", "EDNS",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET",
]);
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const statusOf = (err: any): number | undefined =>
  err?.response?.status ?? err?.status ?? err?.statusCode ?? err?.$metadata?.httpStatusCode;

/** A failure worth trying again: the network, a timeout, rate limiting or a temporary server error. */
export function isTransientError(err: any): boolean {
  if (!err) return false;
  const status = statusOf(err);
  if (status !== undefined) return TRANSIENT_STATUS.has(Number(status));
  const code = err.code ?? err.cause?.code;
  if (code && TRANSIENT_CODES.has(String(code))) return true;
  const name = err.name ?? err.cause?.name;
  if (name === "TimeoutError" || name === "AbortError") return true;
  return /timeout|timed out|socket hang up|network|fetch failed|ECONNRESET/i.test(String(err.message ?? ""));
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Wait before try `attempt` (1-based): 400ms, 800ms, 1.6s… capped, with jitter so servers don't retry in lockstep. */
export function backoffDelay(attempt: number, baseMs = 400, maxMs = 5_000) {
  const exp = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
  return Math.round(exp / 2 + Math.random() * (exp / 2));
}

/** Honors a Retry-After header (seconds or a date) when the service sends one, up to `maxMs`. */
function retryAfterMs(err: any, maxMs = 5_000): number | null {
  const raw = err?.response?.headers?.["retry-after"] ?? err?.headers?.get?.("retry-after");
  if (!raw) return null;
  const secs = Number(raw);
  const ms = Number.isFinite(secs) ? secs * 1000 : new Date(String(raw)).getTime() - Date.now();
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, maxMs) : null;
}

/**
 * Runs `fn`, trying again after temporary failures with exponential backoff.
 * Errors that aren't temporary (bad input, 401/403/404) are thrown straight away.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  { retries = DEFAULT_RETRIES, label = "outbound call", shouldRetry = isTransientError }:
    { retries?: number; label?: string; shouldRetry?: (err: unknown) => boolean } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt > retries || !shouldRetry(err)) throw err;
      const wait = retryAfterMs(err) ?? backoffDelay(attempt);
      logger.warn(`${label} failed (try ${attempt} of ${retries + 1}), retrying in ${wait}ms: ${(err as any)?.message ?? err}`);
      await sleep(wait);
    }
  }
}

/**
 * fetch with a time limit and retries. Reads (GET/HEAD) retry by default; other methods only
 * when `retries` is passed, i.e. when the caller knows the call can't take effect twice.
 */
export async function fetchWithRetry(
  url: string | URL,
  init: RequestInit = {},
  { timeoutMs = OUTBOUND_TIMEOUT_MS, retries, label }: { timeoutMs?: number; retries?: number; label?: string } = {},
): Promise<Response> {
  const method = String(init.method ?? "GET").toUpperCase();
  const tries = retries ?? (method === "GET" || method === "HEAD" ? DEFAULT_RETRIES : 0);
  return withRetry(async () => {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    // Temporary server answers are retried like network errors
    if (TRANSIENT_STATUS.has(res.status) && tries > 0) {
      const err: any = new Error(`${method} ${String(url).split("?")[0]} answered ${res.status}`);
      err.status = res.status;
      err.headers = res.headers;
      err.response = { status: res.status };
      throw Object.assign(err, { finalResponse: res });
    }
    return res;
  }, { retries: tries, label: label ?? `${method} ${String(url).split("?")[0]}` })
    .catch(err => {
      // Out of retries on a temporary status: hand back the real response so callers see it
      if (err?.finalResponse) return err.finalResponse as Response;
      throw err;
    });
}

/** A fetch for clients that take one (e.g. the Intuition GraphQL client): time limit + retries on reads. */
export const resilientFetch: typeof fetch = (input: any, init?: RequestInit) =>
  fetchWithRetry(input, init, { label: "Intuition GraphQL", retries: DEFAULT_RETRIES });

// ─── axios: one place for every axios call in the server ────────────────────
let axiosConfigured = false;

/**
 * Every axios request gets a time limit, and reads (GET/HEAD/OPTIONS) that fail for a temporary
 * reason are retried with backoff. POSTs (e.g. OAuth code exchanges, which work once) are not.
 */
export function configureAxiosResilience() {
  if (axiosConfigured) return;
  axiosConfigured = true;
  axios.defaults.timeout = OUTBOUND_TIMEOUT_MS;

  axios.interceptors.response.use(undefined, async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { __retryCount?: number }) | undefined;
    const method = String(config?.method ?? "get").toLowerCase();
    if (!config || !["get", "head", "options"].includes(method) || !isTransientError(error)) throw error;
    config.__retryCount = (config.__retryCount ?? 0) + 1;
    if (config.__retryCount > DEFAULT_RETRIES) throw error;
    const wait = retryAfterMs(error) ?? backoffDelay(config.__retryCount);
    logger.warn(`axios ${method.toUpperCase()} ${String(config.url ?? "").split("?")[0]} failed (try ${config.__retryCount} of ${DEFAULT_RETRIES + 1}), retrying in ${wait}ms: ${error.message}`);
    await sleep(wait);
    return axios.request(config);
  });
}
