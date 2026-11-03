"use client";

import { useEffect, useState } from "react";
import { useLiveRefresh } from "../../hooks/use-live-refresh";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, ImageIcon, Pencil } from "lucide-react";
import StudioLoader from "../studio/StudioLoader";
import { projectApiRequest, getStoredProjectInfo } from "../../lib/projectApi";
import { TASK_CATALOG } from "./CreateNewCampaign";
import { campaignXpTotal, stageXpShares } from "../../lib/campaignXp";

type PreviewQuest = { _id: string; quest?: string; link?: string; stage?: string; order?: number; points?: number; taskTypeId?: string };
type PreviewCampaign = {
  _id: string; title?: string; description?: string; status?: string; starts_at?: string; ends_at?: string;
  projectCoverImage?: string; rewardsEnabled?: boolean; maxParticipants?: number;
  reward?: { xp?: number; pool?: number; trustTokens?: number };
  rewardAsset?: { token?: string; network?: string };
  stages?: { key: string; name: string; returnDays?: number; allocationPct?: number | null }[];
};

const fmtDate = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Not set";
};

/** Read-only page showing a campaign as it was set up: details, rewards, stages and tasks. */
export default function CampaignPreview() {
  const router = useRouter();
  const [data, setData] = useState<{ c: PreviewCampaign; quests: PreviewQuest[] } | null>(null);
  const [error, setError] = useState("");
  const isSuperAdmin = (getStoredProjectInfo()?.role as string) === "superadmin";

  /** `quiet` refreshes in the background, keeping what is shown if the request fails. */
  const load = (quiet = false) => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setError("No campaign selected."); return; }
    return projectApiRequest<{ campaignFound?: PreviewCampaign; campaignQuests?: PreviewQuest[] }>({ method: "GET", endpoint: "/hub/get-campaign", params: { id } })
      .then(({ campaignFound, campaignQuests = [] }) => {
        if (!campaignFound) throw new Error("Campaign not found.");
        setData({ c: campaignFound, quests: campaignQuests });
      })
      .catch(err => { if (!quiet) setError(err instanceof Error ? err.message : "The campaign could not be loaded."); });
  };

  useEffect(() => { load(); }, []);
  useLiveRefresh(() => load(true));

  const back = (
    <button
      onClick={() => router.push("/studio-dashboard/campaigns-tab")}
      className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#f7f4fe] border-[0.833px] border-[rgba(28,37,51,0.15)] text-[13px] font-semibold text-[#1c2533] hover:bg-[#efeafb] transition"
    >
      <ArrowLeft className="w-4 h-4" /> Back to campaigns
    </button>
  );

  if (!data) {
    return (
      <div className="p-6 md:p-10 flex flex-1 flex-col gap-6">
        {error && <div>{back}</div>}
        <StudioLoader message="Fetching campaign details…" error={error} />
      </div>
    );
  }

  const { c, quests } = data;
  // Tasks grouped by stage, in order; tasks saved without a known stage go last
  const byOrder = (a: PreviewQuest, b: PreviewQuest) => (a.order ?? 0) - (b.order ?? 0);
  const stages = (c.stages ?? []).map(st => ({ ...st, tasks: quests.filter(q => q.stage === st.key).sort(byOrder) }));
  const loose = quests.filter(q => !stages.some(st => st.key === q.stage)).sort(byOrder);
  if (loose.length) stages.push({ key: "_other", name: stages.length ? "Other tasks" : "Tasks", tasks: loose });

  // XP is paid per stage (1,000 for a one-time campaign, 2,500 split across retention stages); stages
  // without tasks don't count, as on the server
  const paidStages = stages.filter(st => st.tasks.length > 0);
  const xpShares = stageXpShares(paidStages.length);
  const stageXp = (key: string) => { const i = paidStages.findIndex(st => st.key === key); return i >= 0 ? xpShares[i] : 0; };
  const totalXp = paidStages.length ? campaignXpTotal(paidStages.length) : Number(c.reward?.xp ?? 0);
  const rewardToken = c.rewardAsset?.token || "TRUST";

  const cover = c.projectCoverImage && c.projectCoverImage !== "pending" ? c.projectCoverImage : null;
  const pool = Number(c.reward?.pool ?? 0);
  const taskCount = quests.length;
  const stat = "rounded-2xl border-[0.833px] border-[rgba(28,37,51,0.09)] bg-white px-5 py-4";
  const label = "text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a0b4]";

  return (
    <div className="p-6 md:p-10 flex flex-col gap-6 text-[#1c2533] max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {back}
        {isSuperAdmin && c.status !== "Ended" && (
          <button
            onClick={() => router.push(`/studio-dashboard/create-new-campaign?edit=${c._id}`)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#8B3EFE] text-white text-[13px] font-semibold hover:bg-[#7b35e6] transition"
          >
            <Pencil className="w-4 h-4" /> Edit campaign
          </button>
        )}
      </div>

      <div className="rounded-[28px] border-[0.833px] border-[rgba(28,37,51,0.09)] bg-white overflow-hidden">
        <div className="h-48 md:h-60 w-full bg-gradient-to-br from-[#efe8ff] via-[#f4f1fc] to-[#e6f6ff] flex items-center justify-center">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="w-9 h-9 text-[#b9a8ee]" />}
        </div>
        <div className="p-6 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{c.title || "Untitled campaign"}</h1>
          {c.description && c.description !== c.title && <p className="text-sm text-[#69728a] whitespace-pre-line">{c.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={stat}><p className={label}>Starts</p><p className="text-sm font-semibold mt-1">{fmtDate(c.starts_at)}</p></div>
        <div className={stat}><p className={label}>Ends</p><p className="text-sm font-semibold mt-1">{fmtDate(c.ends_at)}</p></div>
        <div className={stat}><p className={label}>Total XP</p><p className="text-sm font-semibold mt-1">{totalXp.toLocaleString()} XP</p></div>
        <div className={stat}>
          <p className={label}>Rewards</p>
          <p className="text-sm font-semibold mt-1">
            {pool > 0 ? `${pool} ${rewardToken} pool${c.maxParticipants ? ` · ${c.maxParticipants} participants` : ""}` : c.rewardsEnabled ? "On" : "Off"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Stages & tasks <span className="text-sm font-medium text-[#69728a]">· {stages.length} stage{stages.length === 1 ? "" : "s"}, {taskCount} task{taskCount === 1 ? "" : "s"}</span>
        </h2>
        {stages.length === 0 && <p className="text-sm text-[#69728a]">No tasks yet.</p>}
        {stages.map((st, si) => (
          <div key={st.key} className="rounded-[24px] border-[0.833px] border-[rgba(28,37,51,0.09)] bg-white p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[15px] font-semibold min-w-0">
                <span className="text-[#8a3ffc] mr-1.5">Stage {si + 1}</span>{st.name}
                {stageXp(st.key) > 0 && <span className="ml-2 text-xs font-semibold text-[#8a3ffc]">{stageXp(st.key).toLocaleString()} XP</span>}
              </p>
              {st.key !== "_other" && (
                <span className="text-xs text-[#69728a]">
                  {(st.returnDays ?? 0) === 0 ? "Immediately" : `After ${st.returnDays} day${st.returnDays === 1 ? "" : "s"}`}
                  {st.allocationPct != null ? ` · ${st.allocationPct}% of rewards` : ""}
                </span>
              )}
            </div>
            {st.tasks.length === 0 ? (
              <p className="text-xs text-[#98a0b4]">No tasks in this stage.</p>
            ) : st.tasks.map(q => {
              const type = TASK_CATALOG.find(t => t.id === q.taskTypeId)?.name;
              return (
                <div key={q._id} className="flex items-start justify-between gap-3 rounded-2xl bg-[#f7f4fe] px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">{q.quest || type || "Task"}</p>
                    {type && q.quest !== type && <p className="text-xs text-[#98a0b4]">{type}</p>}
                    {q.link && (
                      <a href={q.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#6e2bd8] hover:underline break-all mt-0.5">
                        <ExternalLink className="w-3 h-3 shrink-0" /> {q.link}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
