"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, ChevronDown, Clock, Copy, ImageIcon, Inbox, Lock, RefreshCw, Search, Users } from "lucide-react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { projectApiRequest } from "../../lib/projectApi";
import { TASKS } from "../../types/admin";
import StudioLoader from "../studio/StudioLoader";
import { scrollToTop } from "../../lib/scrollToTop";
import { useUrlState } from "../../hooks/use-url-state";
import { useLiveRefresh } from "../../hooks/use-live-refresh";
import { StatsOverview } from "./StatsOverview";
import CampaignSubmissions, { type CampaignSubmission } from "./CampaignSubmissions";

type LiveStatus = "Active" | "Upcoming" | "Ended";
const LIST_FILTERS = ["all", "Active", "Upcoming", "Ended"] as const;

type SubmissionCampaign = {
  _id: string; title: string; projectCoverImage?: string; starts_at: string; ends_at: string; status: LiveStatus;
  hasRewards: boolean; participants: number; completed: number; claimed: number; pendingSubmissions: number; totalSubmissions: number;
};

type StageHistory = {
  key: string; name: string; unlockAt: string; completedAt: string | null; tasksDone: number; totalTasks: number;
  status: "completed" | "in-progress" | "locked";
};

/** Someone who claimed this campaign's reward. */
type Claimer = {
  userId: string; username: string; address: string; profilePic?: string; joinedAt: string; claimedAt: string;
  tasksDone: number; totalTasks: number; stagesCompleted: number; stagesTotal: number;
  /** Stages completed out of all stages on this campaign. */
  retentionRate: number | null;
  /** Average across the person's settled campaigns on Nexura. */
  nexuraScore: number | null; nexuraScoreCampaigns: number;
  meetsRequirement: boolean | null; history: StageHistory[];
};


type CampaignDetails = {
  campaign: {
    _id: string; title: string; projectCoverImage?: string; starts_at: string; ends_at: string; status: LiveStatus;
    hasRewards: boolean; rewardPool: number; maxParticipants: number; nexuraScoreRequirementPct: number | null; totalTasks: number;
  };
  stats: {
    participants: number; completedAllTasks: number; claimedReward: number; averageRetention: number | null; averageNexuraScore: number | null;
    meetingRequirement: number | null; pendingSubmissions: number; approvedSubmissions: number; rejectedSubmissions: number;
  };
  participants: Claimer[];
  submissions: CampaignSubmission[];
};

const STATUS_PILL: Record<LiveStatus, string> = {
  Active: "bg-[rgba(0,168,124,0.92)] text-white",
  Upcoming: "bg-[rgba(47,127,224,0.92)] text-white",
  Ended: "bg-[rgba(61,72,92,0.88)] text-white",
};

const fmtDate = (iso?: string | null) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No date";
};
const shortAddress = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "No wallet");
const retentionColor = (r: number | null) => (r === null ? "#98a0b4" : r >= 75 ? "#00a87c" : r >= 40 ? "#c27c00" : "#e4545b");
const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
/** The Submissions endpoints answer 404 when they aren't available. */
const isMissingEndpoint = (err: unknown) => (err as { status?: number })?.status === 404;

/** Empty state in the same style as Admin Management's. */
function EmptyState({ icon: Icon, title, body, action }: { icon: typeof Inbox; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center pt-[16px]">
      <div className="flex flex-col items-center max-w-[420px] p-[28px]">
        <span className="grid place-items-center size-[56px] rounded-[16px] bg-[rgba(138,63,252,0.1)]">
          <Icon className="size-[26px] text-[#8B3EFE]" />
        </span>
        <p className="pt-[16px] text-[18px] font-semibold leading-[20.7px] tracking-[-0.36px] text-[#1c2533]">{title}</p>
        <p className="pt-[6px] pb-[18px] text-[13.5px] leading-[20.9px] text-[#69728a]">{body}</p>
        {action}
      </div>
    </div>
  );
}

const readCampaignParam = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("campaign"));

interface SubmissionsHubProps {
  /** Bumped by the page after a submission is accepted or rejected, so the data reloads. */
  refreshKey: number;
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedUsers: Set<string>;
  viewedSubmissions: Set<string>;
  toggleUserSelection: (userId: string) => void;
  onOpenSubmission: (task: TASKS) => void;
  handleAction: (id: string, action: "accept" | "reject") => void;
}

/** Studio Submissions: pick a published campaign, then review its submissions and see each participant's progress. */
export default function SubmissionsHub(props: SubmissionsHubProps) {
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // The open campaign lives in the URL (?campaign=), so refresh and the browser back button work
  useEffect(() => {
    setCampaignId(readCampaignParam());
    const onPop = () => setCampaignId(readCampaignParam());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("campaign", id); else url.searchParams.delete("campaign");
    // A different campaign opens on its default tabs
    url.searchParams.delete("view"); url.searchParams.delete("review");
    window.history.pushState(null, "", url.toString());
    setCampaignId(id);
    scrollToTop();
  };

  return campaignId
    ? <CampaignView {...props} campaignId={campaignId} onBack={() => open(null)} />
    : <CampaignList refreshKey={props.refreshKey} onOpen={open} />;
}

// ─── Campaign list ────────────────────────────────────────────────────────────
function CampaignList({ refreshKey, onOpen }: { refreshKey: number; onOpen: (id: string) => void }) {
  const [campaigns, setCampaigns] = useState<SubmissionCampaign[] | null>(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [filter, setFilter] = useUrlState<"all" | LiveStatus>("status", "all", LIST_FILTERS);
  const [refreshing, setRefreshing] = useState(false);

  /** `quiet` refreshes in the background, without the spinner or replacing the list with an error. */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const res = await projectApiRequest<{ campaigns?: SubmissionCampaign[] }>({ method: "GET", endpoint: "/hub/submission-campaigns" });
      setCampaigns(res.campaigns ?? []);
      setError("");
      setUnavailable(false);
    } catch (err) {
      if (quiet) return;
      if (isMissingEndpoint(err)) { setUnavailable(true); setCampaigns([]); }
      else setError(errorMessage(err, "Campaigns could not be loaded."));
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);
  useLiveRefresh(() => load(true));

  if (!campaigns) return <StudioLoader message="Fetching your campaigns…" error={error} />;

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold text-[#1c2533]">Submissions</h1>
        <p className="text-[#69728a] text-sm mt-1">Pick a campaign to review its submissions and see how participants are doing.</p>
      </div>
      <button onClick={() => load()} title="Refresh" className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full text-[#3d485c] hover:bg-[#efeafb] transition">
        <RefreshCw className={cn("w-5 h-5", refreshing && "animate-spin")} />
      </button>
    </div>
  );
  // No live campaigns yet (or the list can't be fetched right now): the same empty state either way
  if (unavailable || campaigns.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <EmptyState icon={Inbox} title="No campaigns yet"
          body="Once a campaign is live, it shows here. Click it to see its tasks, review submissions and see who completed it and claimed the reward." />
      </div>
    );
  }

  const counts = { all: campaigns.length, Active: 0, Upcoming: 0, Ended: 0 } as Record<"all" | LiveStatus, number>;
  campaigns.forEach(c => { counts[c.status]++; });
  const shown = filter === "all" ? campaigns : campaigns.filter(c => c.status === filter);
  const totalPending = campaigns.reduce((n, c) => n + c.pendingSubmissions, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-[#1c2533]">Submissions</h1>
          <p className="text-[#69728a] text-sm mt-1">
            Pick a campaign to review its submissions and see how each participant is doing.
            {totalPending > 0 && <span className="text-[#c27c00] font-semibold"> {totalPending} waiting for review.</span>}
          </p>
        </div>
        <button onClick={() => load()} title="Refresh" className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full text-[#3d485c] hover:bg-[#efeafb] transition">
          <RefreshCw className={cn("w-5 h-5", refreshing && "animate-spin")} />
        </button>
      </div>

      <div className="flex gap-6 border-b-[0.833px] border-[rgba(28,37,51,0.09)] overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["all", "Active", "Upcoming", "Ended"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("pb-3 px-1 text-[15px] font-medium whitespace-nowrap border-b-2 -mb-px transition",
              filter === f ? "border-[#8B3EFE] text-[#1c2533]" : "border-transparent text-[#69728a] hover:text-[#1c2533]")}>
            {f === "all" ? "All" : f === "Active" ? "Live" : f} ({counts[f]})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Inbox} title={`No ${filter === "Active" ? "live" : filter.toLowerCase()} campaigns`} body="Campaigns in this group show up here." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {shown.map(c => (
            <button key={c._id} onClick={() => onOpen(c._id)} className="text-left">
              <Card className="h-full bg-white text-[#1c2533] border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[28px] overflow-hidden shadow-none flex flex-col transition hover:border-[rgba(138,63,252,0.35)] hover:shadow-[0_8px_24px_rgba(28,37,51,0.06)]">
                <div className="relative h-32 w-full shrink-0">
                  {c.projectCoverImage && c.projectCoverImage !== "pending" ? (
                    <img src={c.projectCoverImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[#efe8ff] via-[#f4f1fc] to-[#e6f6ff] flex items-center justify-center">
                      <ImageIcon className="w-7 h-7 text-[#b9a8ee]" />
                    </div>
                  )}
                  <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_PILL[c.status]}`}>{c.status === "Active" ? "Live" : c.status}</span>
                  {c.pendingSubmissions > 0 && (
                    <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[rgba(245,158,11,0.92)] text-white">{c.pendingSubmissions} to review</span>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[15px] leading-5 truncate">{c.title}</h3>
                    <p className="text-[#69728a] text-xs mt-1">{fmtDate(c.starts_at)} – {fmtDate(c.ends_at)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { k: "Participants", v: c.participants },
                      { k: "Completed", v: c.completed },
                    ].map(s => (
                      <div key={s.k} className="rounded-2xl bg-[#f7f4fe] px-3 py-2">
                        <p className="text-[16px] font-bold text-[#8a3ffc]">{s.v}</p>
                        <p className="text-[11px] text-[#69728a]">{s.k}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── One campaign ─────────────────────────────────────────────────────────────
function CampaignView(props: SubmissionsHubProps & { campaignId: string; onBack: () => void }) {
  const { campaignId, onBack, refreshKey } = props;
  const [data, setData] = useState<CampaignDetails | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useUrlState<"submissions" | "claimers">("view", "submissions", ["submissions", "claimers"]);
  const [refreshing, setRefreshing] = useState(false);

  /** `quiet` refreshes in the background, without the spinner or error message. */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const res = await projectApiRequest<CampaignDetails>({ method: "GET", endpoint: "/hub/campaign-submission-details", params: { id: campaignId } });
      setData(res);
      setError("");
    } catch (err) {
      if (quiet) return;
      setError(isMissingEndpoint(err) ? "This campaign isn't available at the moment. Please try again later." : errorMessage(err, "The campaign could not be loaded."));
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useLiveRefresh(() => load(true));

  const back = (
    <button onClick={onBack} className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[#f7f4fe] border-[0.833px] border-[rgba(28,37,51,0.15)] text-[13px] font-semibold text-[#1c2533] hover:bg-[#efeafb] transition self-start">
      <ArrowLeft className="w-4 h-4" /> All campaigns
    </button>
  );

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        {error && back}
        <StudioLoader message="Fetching campaign submissions…" error={error} />
      </div>
    );
  }

  const { campaign: c, stats } = data;
  const cover = c.projectCoverImage && c.projectCoverImage !== "pending" ? c.projectCoverImage : null;
  const statCards = [
    { k: "Participants", v: String(stats.participants), sub: c.maxParticipants ? `of ${c.maxParticipants} spots` : "joined so far" },
    { k: "Completed all tasks", v: String(stats.completedAllTasks), sub: stats.participants ? `${Math.round((stats.completedAllTasks / stats.participants) * 100)}% of participants` : "no participants yet" },
    ...(c.hasRewards ? [{ k: "Rewards claimed", v: String(stats.claimedReward), sub: `${c.rewardPool} TRUST pool` }] : []),
    {
      k: "Average retention", v: stats.averageRetention === null ? "No data yet" : `${stats.averageRetention}%`,
      sub: stats.averageNexuraScore !== null ? `of claimers · ${stats.averageNexuraScore}% average Nexura score` : "of people who claimed",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        {back}
        <button onClick={() => load()} title="Refresh" className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-full text-[#3d485c] hover:bg-[#efeafb] transition">
          <RefreshCw className={cn("w-5 h-5", refreshing && "animate-spin")} />
        </button>
      </div>

      <Card className="bg-white border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[28px] shadow-none p-4 flex items-center gap-4">
        <div className="h-20 w-28 shrink-0 rounded-2xl overflow-hidden bg-gradient-to-br from-[#efe8ff] via-[#f4f1fc] to-[#e6f6ff] flex items-center justify-center">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="w-6 h-6 text-[#b9a8ee]" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-[#1c2533] truncate">{c.title}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_PILL[c.status]}`}>{c.status === "Active" ? "Live" : c.status}</span>
          </div>
          <p className="text-[#69728a] text-xs mt-1">{fmtDate(c.starts_at)} – {fmtDate(c.ends_at)} · {c.totalTasks} task{c.totalTasks === 1 ? "" : "s"}</p>
        </div>
      </Card>

      <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", statCards.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        {statCards.map(s => (
          <Card key={s.k} className="bg-white border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[40px] shadow-none p-6">
            <span className="text-[#69728a] text-sm font-semibold">{s.k}</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-[#8a3ffc]">{s.v}</span>
            </div>
            <span className="text-[#69728a] text-xs font-medium">{s.sub}</span>
          </Card>
        ))}
      </div>

      <div className="flex gap-6 border-b-[0.833px] border-[rgba(28,37,51,0.09)]">
        {([
          { id: "submissions", label: `Submissions (${data.submissions.length})` },
          { id: "claimers", label: `Claimed reward (${data.participants.length})` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("pb-3 px-1 text-[15px] font-medium whitespace-nowrap border-b-2 -mb-px transition",
              tab === t.id ? "border-[#8B3EFE] text-[#1c2533]" : "border-transparent text-[#69728a] hover:text-[#1c2533]")}>
            {t.label}
            {t.id === "submissions" && stats.pendingSubmissions > 0 && (
              <span className="ml-2 rounded-full bg-[rgba(245,158,11,0.14)] text-[#c27c00] px-2 py-0.5 text-[11px] font-semibold">{stats.pendingSubmissions} pending</span>
            )}
          </button>
        ))}
      </div>

      {tab === "submissions" ? (
        <div>
          <StatsOverview tasks={data.submissions} />
          <CampaignSubmissions
            tasks={data.submissions}
            loading={props.loading || refreshing}
            searchTerm={props.searchTerm}
            setSearchTerm={props.setSearchTerm}
            handleView={id => { const t = data.submissions.find(s => s._id === id); if (t) props.onOpenSubmission(t); }}
            handleAction={props.handleAction}
            onRefresh={() => load()}
          />
        </div>
      ) : (
        <ClaimersTable claimers={data.participants} requirement={c.nexuraScoreRequirementPct} />
      )}
    </div>
  );
}

// ─── People who claimed the reward ────────────────────────────────────────────
function RetentionCell({ rate, detail, below }: { rate: number | null; detail: string; below?: boolean }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-xs font-semibold" style={{ color: retentionColor(rate) }}>
        {rate === null ? "No data yet" : `${rate}%`}
        <span className="text-[#98a0b4] font-medium"> · {detail}</span>
        {below && <span className="text-[#e4545b] font-medium"> · below target</span>}
      </span>
      {rate !== null && (
        <div className="h-1.5 w-full rounded-full bg-[#f1edfb] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${rate}%`, background: retentionColor(rate) }} /></div>
      )}
    </div>
  );
}

function ClaimersTable({ claimers, requirement }: { claimers: Claimer[]; requirement: number | null }) {
  const [query, setQuery] = useState("");
  const [belowOnly, setBelowOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return claimers.filter(p =>
      (!q || p.username.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)) &&
      (!belowOnly || p.meetsRequirement === false));
  }, [claimers, query, belowOnly]);

  const copy = (address: string) => {
    navigator.clipboard.writeText(address).then(() => { setCopied(address); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  };

  const cols = "md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_24px]";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="w-4 h-4 text-[#98a0b4] absolute left-4 top-1/2 -translate-y-1/2" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by username or wallet"
            className="pl-10 h-10 bg-white border-[rgba(28,37,51,0.15)] text-[#1c2533] placeholder:text-[#98a0b4] rounded-full focus-visible:ring-[#8a3ffc]" />
        </div>
        {requirement !== null && (
          <button onClick={() => setBelowOnly(v => !v)}
            className={cn("h-8 px-3 rounded-full text-xs font-semibold transition border-[0.833px] self-start md:self-auto",
              belowOnly ? "bg-[#8B3EFE] text-white border-transparent" : "bg-white text-[#3d485c] border-[rgba(28,37,51,0.15)] hover:bg-[#f7f4fe]")}>
            Below {requirement}% Nexura score
          </button>
        )}
      </div>

      <Card className="bg-white border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[28px] shadow-none overflow-hidden">
        {/* The columns always show, so it's clear what is recorded for each claimer */}
        <div className={cn("grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a0b4] border-b-[0.833px] border-[rgba(28,37,51,0.09)]", cols)}>
          <span>Nexura username</span><span>Wallet address</span><span>Campaign retention</span><span>Nexura score</span><span>Claimed on</span><span className="hidden md:block" />
        </div>
        {shown.length === 0 ? (
          claimers.length === 0
            ? <EmptyState icon={Users} title="No claims yet" body="Each person who completes this campaign and claims the reward is listed here." />
            : <EmptyState icon={Search} title="No one matches" body="Try another username or wallet address." />
        ) : shown.map(p => {
            const open = expanded === p.userId;
            return (
              <div key={p.userId} className="border-b-[0.833px] border-[rgba(28,37,51,0.06)] last:border-b-0">
                <button onClick={() => setExpanded(open ? null : p.userId)}
                  className={cn("w-full text-left grid grid-cols-1 gap-3 md:gap-4 items-center px-5 py-4 hover:bg-[#fbfaff] transition", cols)}>
                  <div className="flex items-center gap-3 min-w-0">
                    {p.profilePic ? (
                      <img src={p.profilePic} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="h-9 w-9 rounded-full shrink-0 bg-[rgba(138,63,252,0.12)] text-[#8a3ffc] font-semibold text-sm inline-flex items-center justify-center">
                        {(p.username || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1c2533] truncate">{p.username || "Unnamed user"}</p>
                      <p className="text-[11px] text-[#98a0b4]">Joined {fmtDate(p.joinedAt)} · {p.tasksDone}/{p.totalTasks} tasks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs text-[#3d485c] truncate" title={p.address}>{shortAddress(p.address)}</span>
                    {p.address && (
                      <span role="button" tabIndex={0} title="Copy wallet address"
                        onClick={e => { e.stopPropagation(); copy(p.address); }}
                        onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); copy(p.address); } }}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-full text-[#69728a] hover:bg-[#efeafb]">
                        {copied === p.address ? <Check className="w-3.5 h-3.5 text-[#00a87c]" /> : <Copy className="w-3.5 h-3.5" />}
                      </span>
                    )}
                  </div>
                  <RetentionCell rate={p.retentionRate} detail={`${p.stagesCompleted}/${p.stagesTotal} stages`} />
                  <RetentionCell rate={p.nexuraScore} below={p.meetsRequirement === false} detail={p.nexuraScoreCampaigns ? `${p.nexuraScoreCampaigns} campaign${p.nexuraScoreCampaigns === 1 ? "" : "s"}` : "no finished campaigns"} />
                  <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(0,225,162,0.16)] text-[#00a87c] px-2.5 py-1 text-[11px] font-semibold w-fit">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {fmtDate(p.claimedAt)}
                  </span>
                  <ChevronDown className={cn("hidden md:block w-4 h-4 text-[#98a0b4] transition-transform", open && "rotate-180")} />
                </button>

                {open && (
                  <div className="px-5 pb-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a0b4] mb-2">Retention history</p>
                    {p.history.length === 0 ? (
                      <p className="text-xs text-[#69728a]">This campaign has no tasks yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {p.history.map((h, i) => (
                          <div key={h.key} className="flex items-center gap-3 rounded-2xl bg-[#f7f4fe] px-4 py-3">
                            <span className={cn("h-7 w-7 shrink-0 rounded-full inline-flex items-center justify-center",
                              h.status === "completed" ? "bg-[rgba(0,225,162,0.16)] text-[#00a87c]" : h.status === "in-progress" ? "bg-[rgba(245,158,11,0.14)] text-[#c27c00]" : "bg-white text-[#98a0b4]")}>
                              {h.status === "completed" ? <Check className="w-4 h-4" /> : h.status === "in-progress" ? <Clock className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#1c2533] truncate"><span className="text-[#8a3ffc] mr-1.5">Stage {i + 1}</span>{h.name}</p>
                              <p className="text-[11px] text-[#69728a]">
                                {h.status === "completed" ? `Completed ${fmtDate(h.completedAt)}`
                                  : h.status === "in-progress" ? `Opened ${fmtDate(h.unlockAt)} · ${h.tasksDone}/${h.totalTasks} tasks done`
                                  : `Opens ${fmtDate(h.unlockAt)}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </Card>
    </div>
  );
}
