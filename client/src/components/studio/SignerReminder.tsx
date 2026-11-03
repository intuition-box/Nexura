"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredProjectToken, isProjectSessionActive } from "@/lib/projectApi";
import { GOVERNANCE_EVENT, fetchGovernance } from "@/lib/adminGovernance";

export const RECOMMENDED_SIGNERS = 3;
const DISMISS_KEY = "nexura-signer-reminder-dismissed";

export default function SignerReminder() {
  const pathname = usePathname();
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    const load = async () => {
      if (!getStoredProjectToken() || !isProjectSessionActive()) return;
      try {
        const snap = await fetchGovernance();
        setCount(snap.signerIds.includes(snap.meId) ? snap.signerIds.length : null);
      } catch { /* governance unavailable */ }
    };
    load();
    window.addEventListener(GOVERNANCE_EVENT, load);
    return () => window.removeEventListener(GOVERNANCE_EVENT, load);
  }, []);

  if (dismissed || count === null || count >= RECOMMENDED_SIGNERS || pathname?.includes("admin-management")) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };
  return (
    <div role="status" className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-[300px] max-w-[calc(100vw-32px)] rounded-[24px] bg-white border-[0.833px] border-solid border-[rgba(194,124,0,0.3)] shadow-[0_12px_32px_rgba(28,37,51,0.14)] p-[16px]" style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}>
      <div className="flex items-start justify-between gap-[8px]">
        <p className="text-[14px] font-semibold leading-[20px] text-[#1c2533]">{count} of {RECOMMENDED_SIGNERS} recommended signers</p>
        <button onClick={dismiss} aria-label="Dismiss" className="grid place-items-center size-[24px] -mt-[2px] -mr-[4px] rounded-full text-[#69728a] hover:bg-[#f4f1fc]">✕</button>
      </div>
      <p className="pt-[4px] text-[13px] leading-[20px] text-[#69728a]">
        With {RECOMMENDED_SIGNERS}, a compromised wallet can&apos;t approve changes to your hub alone. It&apos;s your choice.
      </p>
      <div className="flex justify-end pt-[12px]">
        <button
          onClick={() => router.push("/studio-dashboard/admin-management?tab=signers")}
          className="min-h-[34px] px-[14px] rounded-[40px] text-[13px] font-semibold text-white"
          style={{ backgroundImage: "linear-gradient(150deg, #9b7cff 0%, #7c5cfc 45%, #5aa8ff 100%)" }}
        >
          Add signers
        </button>
      </div>
    </div>
  );
}
