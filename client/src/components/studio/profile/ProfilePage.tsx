"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StudioLayout from "../StudioLayout";
import { AuthHeader } from "../auth/AuthShell";
import { FONT } from "../auth/tokens";
import { useStudioProfile } from "./useStudioProfile";
import { ConnectedAccountsPanel, ProjectPanel, StudioSetupPanel, type SetupTarget } from "./ProfilePanels";
import { useToast } from "@/hooks/use-toast";

export const ACCOUNT_SETTINGS_URL = "/studio-dashboard/account-settings";

export function ProfileShell({ title, heading, text, action, children }: { title: string; heading: string; text: string; action?: ReactNode; children: ReactNode }) {
  return (
    <StudioLayout title={title} hideHeader>
      <div style={{ fontFamily: FONT }} className="min-h-full">
        <AuthHeader title={title} />
        <div className="px-4 pb-[40px] pt-[30px] md:px-[36px]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold leading-[40.3px] tracking-[-0.65px] text-[#1c2533]">{heading}</h1>
              <p className="max-w-[620px] pt-[5px] text-[14px] leading-[21.7px] text-[#69728a]">{text}</p>
            </div>
            {action}
          </div>
          <div className="flex flex-col gap-[16px] pt-[16px]">{children}</div>
        </div>
      </div>
    </StudioLayout>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const p = useStudioProfile();
  const section = params.get("tab");

  useEffect(() => {
    if (params.get("welcome")) toast({ title: "Your studio is ready", description: "Finish the setup steps to get the most out of Nexura Studio." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!p.loading && section) document.getElementById(section)?.scrollIntoView({ behavior: "smooth" });
  }, [p.loading, section]);

  const isAdminOnly = !p.loading && !!p.admin && !p.isOwner && p.admin.role !== "superadmin";
  useEffect(() => {
    if (isAdminOnly) router.replace(ACCOUNT_SETTINGS_URL);
  }, [isAdminOnly, router]);

  const go = (t: SetupTarget) => {
    if (t === "account") router.push(ACCOUNT_SETTINGS_URL);
    else document.getElementById(t)?.scrollIntoView({ behavior: "smooth" });
  };

  const setupDone = p.steps.every(s => s.done);

  return (
    <ProfileShell title="Profile" heading="Profile" text="Your project's public details and connected accounts.">
      {p.loading || isAdminOnly ? (
        <p className="text-[14px] text-[#69728a]">Loading your profile…</p>
      ) : (
        <>
          {!setupDone && <StudioSetupPanel p={p} go={go} />}
          <ProjectPanel p={p} />
          {p.canSeeAccounts && <ConnectedAccountsPanel p={p} />}
        </>
      )}
    </ProfileShell>
  );
}
