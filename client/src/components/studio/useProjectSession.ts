"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { PROJECT_SESSION_EVENT, endProjectSession, isProjectSessionActive } from "@/lib/projectApi";

const MAIN_APP_PATH = "/discover";

// How often to check whether the token has run out while the page sits open
const CHECK_MS = 30_000;

/** Whether the studio session is still valid. Turns false as soon as the token expires or the server refuses it. */
export function useProjectSession() {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const check = () => setActive(isProjectSessionActive());
    check();
    const id = setInterval(check, CHECK_MS);
    window.addEventListener(PROJECT_SESSION_EVENT, check);
    window.addEventListener("focus", check);
    window.addEventListener("storage", check); // signed in or out in another tab
    return () => {
      clearInterval(id);
      window.removeEventListener(PROJECT_SESSION_EVENT, check);
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", check);
    };
  }, []);

  return active;
}

const WALLET_RECONNECT_MS = 3000;

export function useSessionExpiryRedirect() {
  const active = useProjectSession();
  const { status } = useAccount();
  const [walletGone, setWalletGone] = useState(false);

  useEffect(() => {
    if (status !== "disconnected") { setWalletGone(false); return; }
    const t = setTimeout(() => setWalletGone(true), WALLET_RECONNECT_MS);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (active && !walletGone) return;
    void endProjectSession().finally(() => window.location.replace(MAIN_APP_PATH));
  }, [active, walletGone]);
}

/** Where an admin signs in to the studio again. */
export const STUDIO_SIGN_IN_URL = "/studio/sign-in";
