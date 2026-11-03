"use client";

import { useSyncExternalStore } from "react";

/*
 * Wallets this browser has proven with one signature: address → token from /hub/wallet-proof
 * (30 days). A wallet counts as connected in the Studio only with a token; disconnecting clears them.
 */

const KEY = "nexura:studio-wallet-proofs";
const EVENT = "nexura:studio-wallet-proofs";
const TTL_MS = 29 * 24 * 60 * 60 * 1000;

type Entry = { token: string; at: number };
type Store = Record<string, Entry>;

let cache: Store | null = null;

function read(): Store {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store;
    const now = Date.now();
    cache = Object.fromEntries(Object.entries(raw).filter(([, e]) => e && typeof e.token === "string" && now - e.at < TTL_MS));
  } catch { cache = {}; }
  return cache;
}

function write(next: Store) {
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVENT));
}

export const walletToken = (address?: string | null) => (address ? read()[address.toLowerCase()]?.token ?? null : null);

export const saveWalletToken = (address: string, token: string) => write({ ...read(), [address.toLowerCase()]: { token, at: Date.now() } });

export const clearWalletTokens = () => write({});

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; onChange(); } };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onStorage); };
}

/** Whether this address has been proven in this browser (re-renders when that changes). */
export function useWalletVerified(address?: string | null) {
  return useSyncExternalStore(subscribe, () => !!walletToken(address), () => false);
}
