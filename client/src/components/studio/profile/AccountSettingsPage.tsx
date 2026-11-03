"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileShell } from "./ProfilePage";
import { useStudioProfile } from "./useStudioProfile";
import { MyProfilePanel } from "./ProfilePanels";
import SecurityPanel from "./SecurityPanel";
import { clearProjectSession, projectApiRequest } from "@/lib/projectApi";
import { STUDIO_SIGN_IN_URL } from "../useProjectSession";

export default function AccountSettingsPage() {
  const router = useRouter();
  const p = useStudioProfile();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try { await projectApiRequest({ method: "POST", endpoint: "/hub/logout" }); } catch { /* ends locally either way */ }
    clearProjectSession();
    router.push(STUDIO_SIGN_IN_URL);
  };

  return (
    <ProfileShell
      title="Account settings" heading="Account Settings" text="Your personal sign-in details and security."
      action={
        <button
          type="button" onClick={signOut} disabled={signingOut}
          className="flex min-h-[40px] shrink-0 items-center justify-center rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.15)] bg-[#f7f4fe] px-[16px] py-[10px] text-[14px] font-semibold text-[#1c2533] disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      }
    >
      {p.loading ? (
        <p className="text-[14px] text-[#69728a]">Loading your account…</p>
      ) : (
        <>
          <MyProfilePanel p={p} />
          <SecurityPanel p={p} />
        </>
      )}
    </ProfileShell>
  );
}
