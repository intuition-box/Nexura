"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect, useReconnect, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useSilentWalletConnect } from "./useSilentWalletConnect";
import { clearWalletTokens, saveWalletToken, useWalletVerified, walletToken } from "./studioWalletProof";
import { apiRequestV2, buildUrl } from "@/lib/queryClient";
import { emitSessionChange } from "@/lib/session";
import { endProjectSession } from "@/lib/projectApi";
import { requestLegalConsent, storedConsent } from "@/lib/legal";

/** The main app's wallet session (same login as Studio): set after signing, cleared on disconnect. */
function storeMainAppLogin(addr: string, message: string, signature: string, data: { user?: unknown; accessToken?: string }) {
  try {
    localStorage.setItem("nexura:wallet", JSON.stringify({ address: addr, signedAt: Date.now(), signedMessage: message, signature }));
    if (data.user && data.accessToken) {
      localStorage.setItem("user_profile", JSON.stringify(data.user));
      localStorage.setItem("nexura:token", data.accessToken);
    }
  } catch { /* storage unavailable */ }
  emitSessionChange();
}
function clearMainAppLogin() {
  fetch(buildUrl("/api/user/logout"), { method: "POST", credentials: "include" }).catch(() => {});
  try { ["nexura:wallet", "nexura:token", "user_profile"].forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
  emitSessionChange();
}

const SIGN_TIMEOUT_MS = 90 * 1000;
// One signature request per address at a time, shared by every component on the page
const inFlight = new Map<string, Promise<string | null>>();
// Addresses whose signature was declined on this page: not asked again until they press Sign
const declined = new Set<string>();
// Addresses that signed but the server couldn't record (not asked again automatically on this page)
const verifyFailed = new Set<string>();
const verifyListeners = new Set<() => void>();
const notifyVerify = () => verifyListeners.forEach(f => f());

// Set when the wallet is disconnected inside the studio, so the main-app session address is not shown again
const HIDDEN_KEY = "nexura:studio-wallet-hidden";
const SYNC_KEY = "nexura:studio-wallet-sync";

function broadcast(msg: { type: "connect" | "disconnect"; address?: string }) {
  try { localStorage.setItem(SYNC_KEY, JSON.stringify({ ...msg, at: Date.now() })); } catch { /* storage unavailable */ }
}

/** Address the person signed in with on the main app (or used to create the hub). */
function getSessionWalletAddress(): string | null {
  const read = (key: string, field: string): string | null => {
    try {
      const raw = localStorage.getItem(key);
      const v = raw ? JSON.parse(raw)?.[field] : null;
      return typeof v === "string" && v ? v : null;
    } catch { return null; }
  };
  return read("nexura:wallet", "address") ?? read("user_profile", "address") ?? read("nexura-project:info", "walletAddress");
}

/**
 * Wallet connection for the studio header, via the app's wagmi + RainbowKit setup.
 * Shows the live wagmi connection, or — when the main app is signed in but wagmi hasn't
 * restored a connection — the address from that session, so people don't have to connect twice.
 * Unlike useWallet(), this never runs the main-app sign-in flow.
 */
export function useStudioWallet() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [, rerender] = useState(0);
  useEffect(() => {
    const f = () => rerender(n => n + 1);
    verifyListeners.add(f);
    return () => { verifyListeners.delete(f); };
  }, []);

  useEffect(() => {
    const addr = getSessionWalletAddress();
    let hidden: string | null = null;
    try { hidden = localStorage.getItem(HIDDEN_KEY); } catch {}
    setSessionAddress(addr && addr.toLowerCase() !== hidden?.toLowerCase() ? addr : null);
  }, []);

  // The shown session address needs a live wallet connection to sign: restore it without a popup
  const silentConnect = useSilentWalletConnect();
  useEffect(() => {
    if (sessionAddress && !isConnected) silentConnect(sessionAddress).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionAddress]);

  // A fresh connection clears any earlier studio disconnect, and tells the other open tabs
  const lastLive = useRef<string | null>(null);
  useEffect(() => {
    if (isConnected && address) {
      declined.delete(address.toLowerCase());
      lastLive.current = address;
      try { localStorage.removeItem(HIDDEN_KEY); } catch {}
      broadcast({ type: "connect", address });
    } else if (lastLive.current) {
      // Disconnected from the wallet extension: the Studio disconnects too
      try { localStorage.setItem(HIDDEN_KEY, lastLive.current); } catch {}
      lastLive.current = null;
      setSessionAddress(null);
      clearWalletTokens();
      clearMainAppLogin();
      void endProjectSession();
      broadcast({ type: "disconnect" });
    }
  }, [isConnected, address]);

  // Another tab connected or disconnected: follow it
  const { reconnect } = useReconnect();
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SYNC_KEY || !e.newValue) return;
      try {
        const msg = JSON.parse(e.newValue) as { type: "connect" | "disconnect"; address?: string };
        if (msg.type === "disconnect") {
          setSessionAddress(null);
          if (isConnected) disconnect();
        } else if (!isConnected) {
          reconnect();
        }
      } catch { /* ignore malformed messages */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isConnected, disconnect, reconnect]);

  /**
   * Connect, or when a wallet is already connected, choose another account: browser wallets show
   * their account picker; anything else is disconnected and the connect window opens.
   */
  const connect = useCallback(async () => {
    if (!isConnected) { openConnectModal?.(); return; }
    const eth = (window as unknown as { ethereum?: { request?: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (eth?.request) {
      try { await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] }); return; }
      catch (err) { if ((err as { code?: number })?.code === 4001) return; /* closed the picker */ }
    }
    disconnect();
    setTimeout(() => openConnectModal?.(), 300);
  }, [isConnected, openConnectModal, disconnect]);

  const disconnectWallet = useCallback(() => {
    const shown = (isConnected && address) || sessionAddress;
    if (shown) { try { localStorage.setItem(HIDDEN_KEY, shown); } catch {} }
    lastLive.current = null;
    setSessionAddress(null);
    clearWalletTokens();
    clearMainAppLogin();
    void endProjectSession();
    if (isConnected) disconnect();
    broadcast({ type: "disconnect" });
  }, [isConnected, address, sessionAddress, disconnect]);

  // Only a live wallet connection counts: a remembered address is never shown as connected,
  // so the header, the sign-in card and every other place agree with the wallet extension
  const shown = isConnected && address ? (address as string) : null;
  const verified = useWalletVerified(shown);
  const live = isConnected && address ? (address as string) : null;

  /** Signs the login message once for the live wallet and keeps its token. Returns the token. */
  const verify = useCallback(async (): Promise<string | null> => {
    const addr = live ?? (await silentConnect(sessionAddress));
    if (!addr) { openConnectModal?.(); return null; }
    const key = addr.toLowerCase();
    const kept = walletToken(addr);
    if (kept) return kept;
    const running = inFlight.get(key);
    if (running) return running;
    const job = (async () => {
      declined.delete(key);
      verifyFailed.delete(key);
      notifyVerify();
      const message = `Nexura Wallet Login
Address: ${addr}
Nonce: ${Date.now()}`;
      let signature: string;
      try {
        if (!(await requestLegalConsent())) throw new Error("terms declined");
        signature = await Promise.race([
          signMessageAsync({ message }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), SIGN_TIMEOUT_MS)),
        ]);
      } catch {
        // Rejected in the wallet (or no answer): the wallet is disconnected, and connecting again asks again
        declined.add(key);
        lastLive.current = null;
        setSessionAddress(null);
        try { localStorage.setItem(HIDDEN_KEY, addr); } catch {}
        disconnect();
        return null;
      }
      try {
        // One wallet login for both apps: this signs in to the main app and proves the wallet to Studio
        const referrer = (() => { try { return localStorage.getItem("ref"); } catch { return null; } })();
        const res = await apiRequestV2("POST", "/api/user/sign-in", { address: addr, referrer, message, signature, consent: storedConsent() }) as { walletToken?: string; user?: unknown; accessToken?: string };
        if (!res?.walletToken) throw new Error("no wallet token");
        saveWalletToken(addr, res.walletToken);
        storeMainAppLogin(addr, message, signature, res);
        return res.walletToken;
      } catch {
        // Signed, but the server couldn't record it: stay connected; the next action asks again
        verifyFailed.add(key);
        return null;
      }
    })().finally(() => { inFlight.delete(key); notifyVerify(); });
    inFlight.set(key, job);
    return job;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, sessionAddress, signMessageAsync, openConnectModal, disconnect]);

  const key = shown?.toLowerCase() ?? "";
  return {
    address: shown,
    /** Signed once in this browser, so it counts as this person's wallet. */
    verified,
    verifying: !!key && inFlight.has(key),
    /** They closed the signature request; the Sign button asks again. */
    verifyDeclined: !!key && (declined.has(key) || verifyFailed.has(key)),
    /** Signed, but the server couldn't record it. */
    verifyFailed: !!key && verifyFailed.has(key),
    verify,
    /** The wallet token to send with sign-in or sign-up. */
    token: verified ? walletToken(shown) : null,
    live,
    connect,
    disconnect: disconnectWallet,
  };
}
