/**
 * fetch with a time limit and retries, for every call the app makes to the Nexura API and other
 * services. A stuck request gives up instead of leaving a spinner forever, and reads (GET/HEAD)
 * that fail for a temporary reason (network blip, 429, 502/503/504) are tried again with growing
 * waits. Writes are never retried here, so nothing is submitted twice.
 */

/** Time limit for a normal request; uploads get longer. */
export const REQUEST_TIMEOUT_MS = 30_000;
export const UPLOAD_TIMEOUT_MS = 120_000;
const READ_RETRIES = 2;
const RETRY_STATUS = new Set([429, 502, 503, 504]);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** 500ms, 1s, 2s… with jitter, capped at 5s. */
const backoff = (attempt: number) => {
  const exp = Math.min(5_000, 500 * 2 ** (attempt - 1));
  return Math.round(exp / 2 + Math.random() * (exp / 2));
};

/** Combines the caller's own abort signal (if any) with the time limit. */
function withTimeout(signal: AbortSignal | null | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (anyFn) return anyFn([signal, timeout]);
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  signal.addEventListener("abort", abort, { once: true });
  timeout.addEventListener("abort", abort, { once: true });
  return ctrl.signal;
}

export class RequestTimeoutError extends Error {
  constructor() {
    super("The server took too long to respond. Check your connection and try again.");
    this.name = "RequestTimeoutError";
  }
}

export async function resilientFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  { timeoutMs, retries }: { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const method = String(init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const isRead = method === "GET" || method === "HEAD";
  const tries = retries ?? (isRead ? READ_RETRIES : 0);
  const limit = timeoutMs ?? (init.body instanceof FormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(input, { ...init, signal: withTimeout(init.signal, limit) });
      if (attempt <= tries && RETRY_STATUS.has(res.status)) {
        const after = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 5_000) : backoff(attempt));
        continue;
      }
      return res;
    } catch (err) {
      // The caller cancelled on purpose: don't retry or rename it
      if (init.signal?.aborted) throw err;
      const timedOut = (err as { name?: string })?.name === "TimeoutError";
      if (attempt > tries) throw timedOut ? new RequestTimeoutError() : err;
      await sleep(backoff(attempt));
    }
  }
}
