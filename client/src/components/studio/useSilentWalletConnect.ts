"use client";

import { useCallback } from "react";
import { useAccount, useConfig } from "wagmi";
import { connect, getAccount, reconnect } from "wagmi/actions";

/**
 * The studio header can show the address from the main-app sign-in while wagmi itself has no live
 * connection in this tab, and signing needs a live one. This connects a wallet that has already
 * approved this site, which wallets do without a popup. Returns the connected address, or null
 * if none is approved (then the caller opens the connect modal).
 */
export function useSilentWalletConnect() {
  const config = useConfig();
  const { address, isConnected } = useAccount();

  return useCallback(async (preferred?: string | null): Promise<string | null> => {
    if (isConnected && address) return address;
    const connected = () => {
      const a = getAccount(config);
      return a.isConnected && a.address ? a.address : null;
    };
    try { await reconnect(config); } catch { /* nothing to restore */ }
    if (connected()) return connected();

    for (const connector of config.connectors) {
      try {
        if (!(await connector.isAuthorized())) continue;
        // Prefer the wallet holding the address the studio already shows
        if (preferred) {
          const accounts = await connector.getAccounts().catch(() => [] as readonly string[]);
          if (accounts.length && !accounts.some(a => a.toLowerCase() === preferred.toLowerCase())) continue;
        }
        await connect(config, { connector });
        if (connected()) return connected();
      } catch { /* try the next wallet */ }
    }
    return null;
  }, [config, address, isConnected]);
}
