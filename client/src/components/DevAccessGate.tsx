"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { BACKEND_URL } from "@/lib/constants";
import { DEV_ACCESS_DENIED_EVENT, DEV_ACCESS_ON, getDevAccessToken, setDevAccessToken, type DevAccessRole } from "@/lib/devAccess";

const DevAccessContext = createContext<DevAccessRole | null>(null);
export const useDevAccess = () => useContext(DevAccessContext);

export const devAccessApi = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${BACKEND_URL}/api/dev-access${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error || (res.status === 404
      ? "Sign-in for the test app isn't available on the server yet. Try again shortly."
      : `Sign-in failed (${res.status}). Try again.`)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function DevAccessGate({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<DevAccessRole | null>(null);
  const [checking, setChecking] = useState(DEV_ACCESS_ON);
  // The server decides whether the test app is gated: a server without the gate (or with it off) lets everyone in
  const [open, setOpen] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await devAccessApi<{ enabled?: boolean; access: DevAccessRole | null }>("/status");
      if (res.enabled === false) { setOpen(true); return; }
      if (!res.access) setDevAccessToken(null);
      setRole(res.access);
    } catch (err) {
      if ((err as { status?: number })?.status === 404) { setOpen(true); return; }
      setRole(null);
    } finally {
      setChecking(false);
    }
  }, []);

  // Disconnecting the wallet (after it was connected on this page) ends the test-app pass
  const { isConnected } = useAccount();
  const wasConnected = useRef(false);
  useEffect(() => {
    if (isConnected) { wasConnected.current = true; return; }
    if (wasConnected.current) { wasConnected.current = false; setDevAccessToken(null); setRole(null); }
  }, [isConnected]);

  useEffect(() => {
    if (!DEV_ACCESS_ON) return;
    check();
    const onDenied = () => setRole(null);
    window.addEventListener(DEV_ACCESS_DENIED_EVENT, onDenied);
    return () => window.removeEventListener(DEV_ACCESS_DENIED_EVENT, onDenied);
  }, [check]);

  if (!DEV_ACCESS_ON || open) return <>{children}</>;
  if (checking) return <Screen><p className="text-[14px] text-[#69728a]">Checking access…</p></Screen>;
  if (!role) return <SignInScreen onIn={setRole} />;
  return <DevAccessContext.Provider value={role}>{children}</DevAccessContext.Provider>;
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f7f5ff] px-4 text-[#1c2533]" style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}>
      <div className="flex w-full max-w-[420px] flex-col items-center rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.09)] bg-white px-[28px] py-[36px] text-center shadow-[0px_22px_25px_rgba(28,37,51,0.08)]">
        <img src="/studio-auth/logo.png" alt="Nexura" className="h-[30px] w-auto" />
        <div className="flex w-full flex-col items-center pt-[22px]">{children}</div>
      </div>
    </div>
  );
}

type SignInStep = "sign" | "allowed" | "denied";

/**
 * Connect a wallet, then sign to check it against the whitelist. A listed wallet sees "You're on the
 * whitelist" and can keep the pass for 7 days before continuing; an unlisted one is told so.
 */
function SignInScreen({ onIn }: { onIn: (role: DevAccessRole) => void }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [step, setStep] = useState<SignInStep>("sign");
  const [pass, setPass] = useState<{ token: string; access: DevAccessRole } | null>(null);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A different wallet starts again at signing
  useEffect(() => { setStep("sign"); setPass(null); setError(""); }, [address]);

  const signToCheck = async () => {
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      const { message } = await devAccessApi<{ message: string }>(`/challenge?address=${address}`);
      const signature = await signMessageAsync({ message });
      try {
        const res = await devAccessApi<{ token: string; access: DevAccessRole }>("/verify", { method: "POST", body: JSON.stringify({ message, signature }) });
        setPass(res);
        setStep("allowed");
      } catch (err) {
        if ((err as { status?: number })?.status === 403) { setStep("denied"); return; }
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error && !/user rejected|denied/i.test(err.message) ? err.message : "Signature cancelled.");
    } finally {
      setBusy(false);
    }
  };

  const continueToApp = () => {
    if (!pass) return;
    setDevAccessToken(pass.token, remember);
    onIn(pass.access);
  };

  const btn = "h-[48px] w-full rounded-full text-[14.5px] font-semibold transition disabled:opacity-60";
  const wallet = <span className="self-center rounded-full bg-[#f4f1fc] px-[12px] py-[6px] font-mono text-[12.5px] text-[#3d485c]">{address && short(address)}</span>;
  const otherWallet = (
    <button onClick={() => { disconnect(); setError(""); }} disabled={busy} className={`${btn} border-[1.25px] border-[rgba(28,37,51,0.15)] bg-white text-[#1c2533] hover:bg-[#f7f4fe]`}>Use another wallet</button>
  );
  return (
    <Screen>
      <p className="text-[22px] font-semibold tracking-[-0.5px]">Private test app</p>
      <p className="pt-[6px] text-[14px] leading-[21.7px] text-[#69728a]">This early version of Nexura is open to the Nexura team and invited testers. Connect your approved wallet to continue.</p>
      <div className="flex w-full flex-col gap-[10px] pt-[24px]">
        {!isConnected ? (
          <button onClick={openConnectModal} className={`${btn} bg-[#8b3efe] text-white hover:bg-[#7b35e6]`}>Connect wallet</button>
        ) : step === "allowed" ? (
          <>
            <div className="flex items-center gap-[10px] rounded-[20px] border-[1.25px] border-[rgba(0,225,162,0.4)] bg-[rgba(0,225,162,0.12)] px-[16px] py-[12px] text-left">
              <span className="flex size-[20px] shrink-0 items-center justify-center rounded-full bg-[#00a87c] text-[12px] font-bold text-white">✓</span>
              <p className="text-[13.5px] leading-[20px] text-[#1c2533]"><b className="font-semibold">You&apos;re on the whitelist.</b> <span className="font-mono">{address && short(address)}</span></p>
            </div>
            <label className="flex cursor-pointer items-center gap-[8px] self-start py-[4px] text-[13.5px] text-[#3d485c]">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="size-[16px] accent-[#8a3ffc]" />
              Keep me signed in for 7 days
            </label>
            <button onClick={continueToApp} className={`${btn} bg-[#8b3efe] text-white hover:bg-[#7b35e6]`}>Continue to the app</button>
          </>
        ) : step === "denied" ? (
          <>
            <div className="rounded-[20px] border-[1.25px] border-[rgba(228,84,91,0.45)] bg-[rgba(228,84,91,0.08)] px-[16px] py-[12px] text-left">
              <p className="text-[14px] font-semibold text-[#1c2533]">This wallet isn&apos;t on the whitelist</p>
              <p className="pt-[2px] text-[13px] leading-[19.5px] text-[#3d485c]"><span className="font-mono">{address && short(address)}</span> can&apos;t open the test app. Ask the Nexura team for access, or connect another wallet.</p>
            </div>
            {otherWallet}
          </>
        ) : (
          <>
            {wallet}
            <button onClick={signToCheck} disabled={busy} className={`${btn} bg-[#8b3efe] text-white hover:bg-[#7b35e6]`}>{busy ? "Check your wallet…" : "Sign to check access"}</button>
            {otherWallet}
          </>
        )}
        {error && <p className="text-[13px] text-[#e4545b]">{error}</p>}
      </div>
    </Screen>
  );
}
