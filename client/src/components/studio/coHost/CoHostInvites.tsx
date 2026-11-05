"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { useGovernanceProposer } from "@/components/studio/useGovernanceProposer";
import { declineCoHostInvite, getCoHostInvites, type CoHostInvite } from "@/lib/coHosts";
import { StudioAvatar } from "./CoHostPanel";

const FEE_NOTE: Partial<Record<CoHostInvite["feeStatus"], { label: string; cls: string }>> = {
  held: { label: "Fee held until launch", cls: "bg-[rgba(245,158,11,0.14)] text-[#c27c00]" },
  refundDue: { label: "Refund due", cls: "bg-[rgba(47,127,224,0.12)] text-[#2f7fe0]" },
  refunded: { label: "Refunded", cls: "bg-[rgba(0,225,162,0.16)] text-[#00a87c]" },
};

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : "Something went wrong. Try again.");

export default function CoHostInvites({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const { gov, propose } = useGovernanceProposer();
  const [invites, setInvites] = useState<CoHostInvite[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setInvites(await getCoHostInvites()); } catch { /* keep the last list */ }
  }, []);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  const pendingFor = (kind: "acceptCoHost" | "leaveCoHost", campaignId: string) =>
    gov.proposals.some(p => p.status === "pending" && p.action.kind === kind && p.action.campaignId === campaignId);

  const act = async (key: string, fn: () => Promise<unknown>, done: { title: string; description?: string }) => {
    setBusy(key);
    try {
      await fn();
      toast(done);
      await load();
    } catch (err) {
      toast({ title: "Couldn't update the invitation", description: errorText(err), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const shown = invites.filter(i => i.myStatus === "invited" || (i.myStatus === "accepted" && i.status === "Save") || i.feeStatus === "refundDue" || i.feeStatus === "refunded");
  if (!shown.length) return null;

  return (
    <div className="flex flex-col gap-[12px]">
      <p className="text-[18px] font-semibold tracking-[-0.36px] text-[#1c2533]">Co-host invitations</p>
      {shown.map(i => {
        const accepting = pendingFor("acceptCoHost", i.campaignId);
        const leaving = pendingFor("leaveCoHost", i.campaignId);
        const meta = { campaignId: i.campaignId, campaignTitle: i.title, hostName: i.host.name };
        const fee = FEE_NOTE[i.feeStatus];
        return (
          <div key={i.campaignId} className="flex flex-col gap-[12px] rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.09)] bg-white p-[20px] md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-[12px]">
              <StudioAvatar studio={i.host} size={40} />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[#1c2533]">{i.title}</p>
                <p className="truncate text-[13px] text-[#69728a]">
                  {i.host.name}
                  {i.myStages.length > 0 && ` · Your stages: ${i.myStages.join(", ")}`}
                  {i.myStatus === "accepted" && Number(i.rewardShare) > 0 && ` · You fund ${i.rewardShare} ${i.rewardToken} of rewards`}
                  {` · Launch fee share: ${i.launchFeeShare} TRUST`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-[8px]">
              {fee && <span className={cn("rounded-full px-[10px] py-[3px] text-[12px] font-semibold", fee.cls)}>{fee.label}</span>}
              {i.myStatus !== "invited" && i.myStatus !== "accepted" ? null : i.myStatus === "accepted" ? (
                <>
                  <span className={cn("rounded-full px-[10px] py-[3px] text-[12px] font-semibold", i.ready ? "bg-[rgba(0,225,162,0.16)] text-[#00a87c]" : "bg-[rgba(47,127,224,0.12)] text-[#2f7fe0]")}>
                    {i.ready ? "Ready" : "Building your stages"}
                  </span>
                  {canManage && (
                    <Link href={`/studio-dashboard/create-new-campaign?cohost=${i.campaignId}`}
                      className="rounded-full bg-[#8b3efe] px-[14px] py-[6px] text-[13px] font-semibold text-white hover:bg-[#7b35e6]">
                      {i.ready ? "View your stages" : "Build your stages"}
                    </Link>
                  )}
                  {canManage && (
                    <button type="button" disabled={!!busy || leaving}
                      onClick={() => act(`leave:${i.campaignId}`, () => propose(`Stop co-hosting: ${i.title}`, `Leaves ${i.host.name}'s draft before launch; a held fee share is refunded`, { kind: "leaveCoHost", ...meta }),
                        { title: "Proposal sent", description: "Your signers can approve leaving in Admin Management." })}
                      className="rounded-full border-[1.25px] border-[rgba(228,84,91,0.34)] px-[14px] py-[6px] text-[13px] font-semibold text-[#e4545b] hover:bg-[rgba(248,113,113,0.08)] disabled:opacity-60">
                      {leaving ? "Leaving proposed" : "Leave"}
                    </button>
                  )}
                </>
              ) : canManage ? (
                <>
                  <button type="button" disabled={!!busy || accepting}
                    onClick={() => act(`decline:${i.campaignId}`, () => declineCoHostInvite(i.campaignId), { title: "Invitation declined" })}
                    className="rounded-full border-[1.25px] border-[rgba(28,37,51,0.15)] bg-white px-[14px] py-[6px] text-[13px] font-semibold text-[#1c2533] hover:bg-[#f7f4fe] disabled:opacity-60">
                    Decline
                  </button>
                  <button type="button" disabled={!!busy || accepting}
                    onClick={() => act(`accept:${i.campaignId}`, () => propose(`Co-host: ${i.title}`, `Co-hosts ${i.host.name}'s campaign: builds and funds its own stages and pays ${i.launchFeeShare} TRUST of the launch fee when ready`, { kind: "acceptCoHost", ...meta }),
                      { title: "Proposal sent", description: "Once your signers approve and a signer executes it, you're a co-host." })}
                    className={cn("rounded-full px-[14px] py-[6px] text-[13px] font-semibold text-white disabled:opacity-60", accepting ? "bg-[#b896ff]" : "bg-[#8b3efe] hover:bg-[#7b35e6]")}>
                    {accepting ? "Waiting for signers" : "Accept"}
                  </button>
                </>
              ) : (
                <span className="rounded-full bg-[rgba(245,158,11,0.14)] px-[10px] py-[3px] text-[12px] font-semibold text-[#c27c00]">Invited</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
