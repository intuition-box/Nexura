"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { configureClient, API_URL_DEV, API_URL_PROD } from "@0xintuition/graphql";

import { buildWagmiConfig } from "@/lib/wagmiConfig";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/lib/auth";
import { initNetworkFromServer, getNetwork } from "@/lib/runtimeNetwork";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import LegalConsentHost from "@/components/LegalConsentHost";
import DevAccessGate from "@/components/DevAccessGate";
import "@/lib/devAccess";

import "@rainbow-me/rainbowkit/styles.css";

const sidebarStyle = {
  "--sidebar-width": "12rem",
  "--sidebar-width-icon": "4rem",
} as React.CSSProperties;

export function Providers({ children }: { children: ReactNode }) {
  // Gate first paint until (a) the network is resolved from the server and
  // (b) the component is mounted, to avoid wagmi/RainbowKit SSR hydration
  // mismatches (wallet state + localStorage are client-only).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await initNetworkFromServer();
      // Point the Intuition GraphQL indexer at the chain the app is actually
      // using. Default SDK config targets mainnet; on testnet that makes
      // getAtomDetails / getTripleDetails return null, which breaks the
      // proof-of-action flow.
      configureClient({ apiUrl: getNetwork() === "mainnet" ? API_URL_PROD : API_URL_DEV });
      setReady(true);
    })();
  }, []);

  // Browser wallet/other extensions inject scripts that can throw unhandled
  // errors (e.g. "The source <origin> has not been authorized yet"), which
  // Next.js's dev error overlay then surfaces on screen. These originate from
  // extension code (chrome-extension:// / moz-extension://), not the app — keep
  // them in the console but out of the on-screen overlay.
  useEffect(() => {
    const isExternalError = (message?: string, stack?: string) =>
      (!!stack && (stack.includes("chrome-extension://") || stack.includes("moz-extension://"))) ||
      (!!message && message.includes("has not been authorized"));
    const onError = (e: ErrorEvent) => {
      if (isExternalError(e.message, e.error?.stack)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        console.warn("[extension error suppressed]", e.message);
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { message?: string; stack?: string } | undefined;
      if (isExternalError(reason?.message, reason?.stack)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        console.warn("[extension rejection suppressed]", reason?.message ?? reason);
      }
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection, true);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection, true);
    };
  }, []);

  const wagmiConfig = useMemo(() => (ready ? buildWagmiConfig() : null), [ready]);

  if (!ready || !wagmiConfig) return null;

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <DevAccessGate>
            <AuthProvider>
              <TooltipProvider>
                <SidebarProvider defaultOpen={false} style={sidebarStyle}>
                  {children}
                </SidebarProvider>
              </TooltipProvider>
              <LegalConsentHost />
            </AuthProvider>
          </DevAccessGate>
          <Toaster />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
