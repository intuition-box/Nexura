"use client";

import { useEffect, useRef } from "react";
import { STUDIO_DATA_EVENT } from "@/lib/projectApi";
import { GOVERNANCE_EVENT } from "@/lib/adminGovernance";

/** How often open Studio pages re-fetch their data in the background. */
export const LIVE_REFRESH_MS = 15_000;

/**
 * Keeps a page's data current without a reload. `refresh` runs:
 * - right after any Studio change (an invite, a vote, an execution, an ownership transfer, ...),
 * - every `intervalMs` while the browser tab is visible, for changes other admins make,
 * - as soon as the person comes back to the tab.
 * `refresh` should update quietly (no loading state, no error toasts).
 */
export function useLiveRefresh(refresh: () => unknown, intervalMs: number = LIVE_REFRESH_MS, enabled = true) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    let running = false;
    let again = false;
    const run = async () => {
      if (document.visibilityState !== "visible") return;
      // A change that lands mid-refresh gets one more pass, so the result is never stale
      if (running) { again = true; return; }
      running = true;
      try { await latest.current(); } catch { /* the next tick retries */ } finally { running = false; }
      if (again) { again = false; void run(); }
    };
    // Several changes in a row (e.g. a vote that also executes) trigger one refresh
    let pending: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => { clearTimeout(pending); pending = setTimeout(run, 250); };

    const id = setInterval(run, intervalMs);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    window.addEventListener(STUDIO_DATA_EVENT, onChange);
    window.addEventListener(GOVERNANCE_EVENT, onChange);
    return () => {
      clearInterval(id);
      clearTimeout(pending);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
      window.removeEventListener(STUDIO_DATA_EVENT, onChange);
      window.removeEventListener(GOVERNANCE_EVENT, onChange);
    };
  }, [intervalMs, enabled]);
}
