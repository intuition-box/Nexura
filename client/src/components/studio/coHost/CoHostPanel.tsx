"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { getCampaignCoHosts, inviteCoHost, removeCoHost, searchStudios, type CampaignCoHost, type CampaignCoHosts, type Studio } from "@/lib/coHosts";

type Search = { state: "idle" } | { state: "short" } | { state: "searching" } | { state: "done"; studios: Studio[] } | { state: "error" };

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : "Something went wrong. Try again.");

export function StudioAvatar({ studio, size = 32 }: { studio: Pick<Studio, "name" | "logo">; size?: number }) {
  return studio.logo
    ? <img src={studio.logo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    : <span className="grid shrink-0 place-items-center rounded-full bg-[rgba(138,63,252,0.12)] text-[13px] font-semibold text-[#8a3ffc]" style={{ width: size, height: size }}>{(studio.name || "?").slice(0, 1).toUpperCase()}</span>;
}

function partnerStatus(c: CampaignCoHost): { label: string; cls: string } {
  if (c.status === "invited") return { label: "Waiting for their signers", cls: "bg-[rgba(245,158,11,0.14)] text-[#c27c00]" };
  if (c.ready) return { label: "Ready", cls: "bg-[rgba(0,225,162,0.16)] text-[#00a87c]" };
  return { label: "Building their stages", cls: "bg-[rgba(47,127,224,0.12)] text-[#2f7fe0]" };
}

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn("relative h-[26px] w-[46px] shrink-0 rounded-[20px] border transition-colors disabled:cursor-not-allowed", on ? "border-[#8a3ffc] bg-[#8a3ffc]" : "border-[#D1D5DB] bg-[#D1D5DB]", disabled && "opacity-70")}>
      <span className={cn("absolute top-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition-all", on ? "left-[23px]" : "left-[3px]")} />
    </button>
  );
}

function PartnersIcon() {
  return (
    <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-[rgba(138,63,252,0.1)]">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
        <circle cx="7" cy="7" r="2.75" stroke="#8a3ffc" strokeWidth="1.5" />
        <circle cx="13.5" cy="7.5" r="2.25" stroke="#8a3ffc" strokeWidth="1.5" />
        <path d="M2.5 16c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4" stroke="#8a3ffc" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 12.2c.5-.2 1-.2 1.5-.2 1.9 0 3.4 1.2 4 3.5" stroke="#8a3ffc" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** "Run this campaign with another studio?" on the Details step: search, invite and follow the partner. */
export default function CoHostPanel({ campaignId, canManage, readOnlyReason }: { campaignId: string | null; canManage: boolean; readOnlyReason?: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<CampaignCoHosts | null>(null);
  const [wanted, setWanted] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<Search>({ state: "idle" });
  const [busy, setBusy] = useState<string | null>(null);
  const searchSeq = useRef(0);

  const load = useCallback(async () => {
    if (!campaignId) return;
    try { setData(await getCampaignCoHosts(campaignId)); } catch { /* keep the last state */ }
  }, [campaignId]);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setSearch({ state: "idle" }); return; }
    if (q.replace(/^@+/, "").length < 2) { setSearch({ state: "short" }); return; }
    const seq = ++searchSeq.current;
    setSearch({ state: "searching" });
    const t = setTimeout(() => {
      searchStudios(q)
        .then(studios => { if (seq === searchSeq.current) setSearch({ state: "done", studios }); })
        .catch(() => { if (seq === searchSeq.current) setSearch({ state: "error" }); });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast({ title: done });
      await load();
      return true;
    } catch (err) {
      toast({ title: "Couldn't update the co-host", description: errorText(err), variant: "destructive" });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const partners = (data?.coHosts ?? []).filter(c => c.status === "invited" || c.status === "accepted");
  const on = wanted || partners.length > 0;
  const q = query.trim();

  return (
    <div className="rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.21)] bg-white shadow-[inset_8px_0_0_0_#8a3ffc]">
      <div className="flex min-h-[78px] items-center gap-[14px] px-[16px] py-[12px]">
        <PartnersIcon />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-[20.925px] text-[#1c2533]">Collaborate with another project on this campaign?</p>
          <p className="text-[12.5px] leading-[18.75px]">
            <span className="font-semibold text-[#3d485c]">{on ? "Co-hosting on" : "Co-hosting off"}</span>
            <span className="text-[#69728a]">{on
              ? " · Invite another studio to run this campaign with you. Their name appears next to yours on the campaign, they build and fund their own stages, and you split the launch fee equally. Their signers have to accept before you can publish."
              : " · Only your studio runs this campaign."}</span>
          </p>
        </div>
        <Switch on={on} disabled={partners.length > 0} onChange={setWanted} label="Collaborate with another project on this campaign" />
      </div>

      {on && (
        <div className="flex flex-col gap-[12px] border-t-[1.25px] border-[rgba(28,37,51,0.09)] px-[24px] pb-[18px] pt-[14px]">
          {!campaignId && <p className="text-[13px] text-[#69728a]">Give the campaign a name below first, so the draft is saved. Then you can invite a studio.</p>}

          {campaignId && partners.length === 0 && (
            canManage ? (
              <>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search studios by name" aria-label="Search studios by name"
                  className="h-[44px] w-full rounded-full border-[1.25px] border-[rgba(28,37,51,0.15)] bg-[#f4f1fc] px-[20px] text-[14px] text-[#1c2533] outline-none placeholder:text-[#98a0b4] focus:border-[#8a3ffc]" />
                <div aria-live="polite">
                  {search.state === "short" && <p className="px-[6px] text-[13px] text-[#69728a]">Type at least 2 characters.</p>}
                  {search.state === "searching" && <p className="px-[6px] text-[13px] text-[#69728a]">Searching…</p>}
                  {search.state === "error" && <p className="px-[6px] text-[13px] text-[#e4545b]">Search isn&apos;t available right now. Try again in a moment.</p>}
                  {search.state === "done" && search.studios.length === 0 && (
                    <p className="px-[6px] text-[13px] text-[#69728a]">No studio found for <b className="text-[#1c2533]">“{q}”</b>. Check the spelling of their studio name.</p>
                  )}
                  {search.state === "done" && search.studios.length > 0 && (
                    <div className="flex flex-col overflow-hidden rounded-[24px] border-[1.25px] border-[rgba(28,37,51,0.12)]">
                      {search.studios.map((s, i) => (
                        <div key={s.id} className={cn("flex items-center gap-[12px] px-[16px] py-[10px]", i > 0 && "border-t-[1.25px] border-[rgba(28,37,51,0.09)]")}>
                          <StudioAvatar studio={s} size={32} />
                          <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#1c2533]">{s.name}</p>
                          <button type="button" disabled={!!busy}
                            onClick={async () => { if (await run(`invite:${s.id}`, () => inviteCoHost(campaignId, s.id), `${s.name} is invited to co-host`)) setQuery(""); }}
                            className="rounded-full bg-[#8b3efe] px-[16px] py-[6px] text-[13px] font-semibold text-white hover:bg-[#7b35e6] disabled:opacity-60">
                            {busy === `invite:${s.id}` ? "Inviting…" : "Invite"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-[#69728a]">{readOnlyReason ?? "Only the Owner or a Super Admin can invite a co-host."}</p>
            )
          )}

          {campaignId && partners.map(c => {
            const status = partnerStatus(c);
            return (
              <div key={c.studio.id} className="flex flex-col gap-[8px]">
                <div className="flex flex-wrap items-center gap-[12px]">
                  <StudioAvatar studio={c.studio} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[#1c2533]">{c.studio.name}</p>
                    <p className="text-[12.5px] text-[#69728a]">{c.stageKeys.length} stage{c.stageKeys.length === 1 ? "" : "s"} built</p>
                  </div>
                  <span className={cn("rounded-full px-[10px] py-[3px] text-[12px] font-semibold", status.cls)}>{status.label}</span>
                  {canManage && c.status === "invited" && (
                    <button type="button" disabled={!!busy} onClick={() => run(`remove:${c.studio.id}`, () => removeCoHost(campaignId, c.studio.id), "Invitation withdrawn")}
                      className="rounded-full border-[1.25px] border-[rgba(228,84,91,0.34)] px-[12px] py-[5px] text-[12.5px] font-semibold text-[#e4545b] hover:bg-[rgba(248,113,113,0.08)] disabled:opacity-60">
                      Withdraw
                    </button>
                  )}
                </div>
                <p className="text-[12.5px] leading-[18.75px] text-[#69728a]">Each studio&apos;s share of the budget and launch fee is shown on the Rewards &amp; Funding step.</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
