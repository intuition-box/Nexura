"use client";

import { useCallback } from "react";
import { useAccount, useSignMessage, useSignTypedData } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { createWalletClient, custom, recoverMessageAddress, recoverTypedDataAddress, type EIP1193Provider } from "viem";
import { useSilentWalletConnect } from "./useSilentWalletConnect";

// Same EIP-712 data the server verifies for every studio action
export const SIGN_DOMAIN = { name: "Nexura Studio", version: "1" } as const;
export const SIGN_TYPES = {
  StudioAction: [
    { name: "hub", type: "string" },
    { name: "action", type: "string" },
    { name: "proposal", type: "string" },
    { name: "proposalId", type: "string" },
    { name: "signer", type: "string" },
    { name: "signedAt", type: "string" },
  ],
} as const;

export type StudioActionMessage = {
  hub: string; action: string; proposal: string; proposalId: string; signer: string; signedAt: string;
};

export type SignatureScheme = "typed" | "text";

// Plain-message form for wallets that can't sign EIP-712 (must match the server)
export const studioActionText = (m: StudioActionMessage) =>
  `Nexura Studio\nAction: ${m.action}\nHub: ${m.hub}\nSubject: ${m.proposal}\nID: ${m.proposalId}\nSigner: ${m.signer}\nSigned at: ${m.signedAt}`;

type WalletError = { code?: number; name?: string; shortMessage?: string; details?: string; message?: string };

const isRejection = (err: unknown) => {
  const e = err as WalletError;
  return e?.code === 4001 || e?.code === 5000 || e?.name === "UserRejectedRequestError" || /reject|denied|cancel/i.test(e?.message ?? "");
};

const walletReason = (err: unknown) => {
  const e = err as WalletError;
  if (isRejection(err)) return "You declined the signature in your wallet.";
  return (e?.name === "UnknownRpcError" && e.details) || e?.shortMessage || e?.message || "The wallet could not sign.";
};

async function typedOrText(typed: () => Promise<`0x${string}`>, text: () => Promise<`0x${string}`>) {
  try {
    return { signature: await typed(), scheme: "typed" as SignatureScheme };
  } catch (err) {
    if (isRejection(err)) throw err;
    return { signature: await text(), scheme: "text" as SignatureScheme };
  }
}

type Injected = { provider: EIP1193Provider; account: string };

/** Browser wallet extensions on the page: EIP-6963 announcements plus the legacy window.ethereum. */
async function injectedProviders(): Promise<EIP1193Provider[]> {
  if (typeof window === "undefined") return [];
  const found: EIP1193Provider[] = [];
  const onAnnounce = (e: Event) => {
    const p = (e as CustomEvent<{ provider?: EIP1193Provider }>).detail?.provider;
    if (p && !found.includes(p)) found.push(p);
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise(r => setTimeout(r, 150));
  window.removeEventListener("eip6963:announceProvider", onAnnounce);
  const legacy = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  if (legacy && !found.includes(legacy)) found.push(legacy);
  return found;
}

/**
 * Finds a wallet extension that already approved this site (no popup), preferring the one holding
 * `preferred`. If none has, asks the first extension for access with its own small prompt.
 */
async function injectedAccount(preferred?: string | null): Promise<Injected | null> {
  const providers = await injectedProviders();
  let fallback: Injected | null = null;
  for (const provider of providers) {
    try {
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      const match = preferred && accounts.find(a => a.toLowerCase() === preferred.toLowerCase());
      if (match) return { provider, account: match };
      if (accounts[0] && !fallback) fallback = { provider, account: accounts[0] };
    } catch { /* try the next wallet */ }
  }
  if (fallback) return fallback;
  for (const provider of providers) {
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (accounts[0]) return { provider, account: accounts[0] };
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4001) throw new Error("Wallet access was declined."); // the person said no
    }
  }
  return null;
}

/**
 * Signs a studio action with the person's wallet (EIP-712, or a plain message if the wallet can't; no gas).
 * Uses the live wagmi connection when there is one; otherwise signs straight through the wallet
 * extension, so a wallet the studio already shows never has to be connected again.
 * The connect modal only opens when no browser wallet is available at all.
 */
export function useStudioSigner() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();
  const silentConnect = useSilentWalletConnect();

  return useCallback(async (message: StudioActionMessage, opts: { linked?: string | null; preferred?: string | null } = {}) => {
    const { linked } = opts;
    const preferred = linked ?? opts.preferred ?? null;
    const checkLinked = (account: string) => {
      if (linked && linked.toLowerCase() !== account.toLowerCase()) {
        throw new Error(`Switch to the wallet linked to your account (${linked.slice(0, 6)}…${linked.slice(-4)}) to sign.`);
      }
    };
    const typed = { domain: SIGN_DOMAIN, types: SIGN_TYPES, primaryType: "StudioAction" as const, message };
    const text = studioActionText(message);

    let account: string | null = isConnected && address ? address : await silentConnect(preferred).catch(() => null);
    let signed: { signature: `0x${string}`; scheme: SignatureScheme };
    try {
      if (account) {
        checkLinked(account);
        const acct = account as `0x${string}`;
        signed = await typedOrText(
          () => signTypedDataAsync({ account: acct, ...typed }),
          () => signMessageAsync({ account: acct, message: text }),
        );
      } else {
        const direct = await injectedAccount(preferred);
        if (!direct) {
          openConnectModal?.();
          throw new Error("Connect a wallet to sign. Signing proves the action came from you.");
        }
        account = direct.account;
        checkLinked(account);
        const client = createWalletClient({ account: account as `0x${string}`, transport: custom(direct.provider) });
        signed = await typedOrText(() => client.signTypedData(typed), () => client.signMessage({ message: text }));
      }
    } catch (err) {
      throw new Error(walletReason(err));
    }
    const { signature, scheme } = signed;
    const recovered = scheme === "text"
      ? await recoverMessageAddress({ message: text, signature })
      : await recoverTypedDataAddress({ ...typed, signature });
    if (recovered.toLowerCase() !== account.toLowerCase()) throw new Error("The signature doesn't match the connected wallet.");
    return { signature, scheme, message, address: account };
  }, [address, isConnected, signTypedDataAsync, signMessageAsync, openConnectModal, silentConnect]);
}
