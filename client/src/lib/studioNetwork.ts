"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { NetworkId } from "@/components/admin/CreateNewCampaign";
import { getNetwork } from "@/lib/runtimeNetwork";

const KEY = "nexura:studio-network";
const EVENT = "nexura-studio-network";

const fallback = (): NetworkId => (getNetwork() === "mainnet" ? "intuition" : "intuition-testnet");

function read(): NetworkId {
  try { return (localStorage.getItem(KEY) as NetworkId | null) ?? fallback(); } catch { return fallback(); }
}

export function setStudioNetwork(id: NetworkId) {
  try {
    if (localStorage.getItem(KEY) === id) return;
    localStorage.setItem(KEY, id);
  } catch { /* storage unavailable: this page still updates below */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) onChange(); };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onStorage); };
}

/** The network shown in every Studio header, the same on every page and tab. */
export function useStudioNetwork(): [NetworkId, (id: NetworkId) => void] {
  const network = useSyncExternalStore(subscribe, read, fallback);
  return [network, useCallback((id: NetworkId) => setStudioNetwork(id), [])];
}
