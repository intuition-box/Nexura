"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

// useLayoutEffect warns during server rendering; it only matters in the browser
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Reads one query param from the current URL (browser only). */
export function readUrlParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

/** Sets (or clears, with null) one query param without a navigation or a new history entry. */
export function writeUrlParam(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
}

/**
 * State kept in a query param (e.g. ?tab=signers), so a refresh or a shared link opens the same view.
 * Values outside `allowed` are ignored. The default value is left out of the URL.
 */
export function useUrlState<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(fallback);

  // Pick up the URL value before the first paint, so the default view never flashes
  useIsoLayoutEffect(() => {
    const v = readUrlParam(key) as T | null;
    if (v && allowed.includes(v)) setValue(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeUrlParam(key, v === fallback ? null : v);
      return v;
    });
  }, [key, fallback]);

  return [value, update] as const;
}
