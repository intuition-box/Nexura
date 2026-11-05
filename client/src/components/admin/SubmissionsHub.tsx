"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Clock, Copy, Inbox, Lock, Search, Users } from "lucide-react";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { projectApiRequest } from "../../lib/projectApi";
import { TASKS } from "../../types/admin";
import { useToast } from "../../hooks/use-toast";
import StudioLoader from "../studio/StudioLoader";
import { scrollToTop } from "../../lib/scrollToTop";
import { useUrlState } from "../../hooks/use-url-state";
import { useLiveRefresh } from "../../hooks/use-live-refresh";
import { TASK_CATALOG } from "./CreateNewCampaign";

type LiveStatus = "Active" | "Upcoming" | "Ended";
type Filter = "pending" | "approved" | "rejected" | "all";
const FILTERS: Filter[] = ["pending", "approved", "rejected", "all"];

type SubmissionCampaign = {
  _id: string; title: string; projectCoverImage?: string; status: LiveStatus; isRetention?: boolean;
  pendingSubmissions: number; approvedSubmissions?: number; rejectedSubmissions?: number; totalSubmissions: number;
};

export type FraudHint = {
  kind: "duplicate-link" | "duplicate-answer" | "wrong-platform" | "short-answer" | "x-mismatch" | "no-x-linked" | "new-account" | "rejected-before";
  label: string;
};

export type CampaignSubmission = TASKS & {
  taskTitle?: string;
  taskTypeId?: string;
  nexuraUsername?: string;
  address?: string;
  questId?: string;
  stageIndex?: number | null;
  stageName?: string;
  taskOrder?: number;
  flags?: FraudHint[];
  reviewedAt?: string | null;
  reviewNote?: string;
};

type StageHistory = {
  key: string; name: string; unlockAt: string; completedAt: string | null; tasksDone: number; totalTasks: number;
  status: "completed" | "in-progress" | "locked";
};

type Claimer = {
  userId: string; username: string; address: string; profilePic?: string; joinedAt: string; claimedAt: string;
  tasksDone: number; totalTasks: number; stagesCompleted: number; stagesTotal: number;
  retentionRate: number | null; nexuraScore: number | null; nexuraScoreCampaigns: number;
  meetsRequirement: boolean | null; history: StageHistory[];
};

type CampaignDetails = {
  campaign: { _id: string; title: string; status: LiveStatus; nexuraScoreRequirementPct: number | null };
  stats: { pendingSubmissions: number; approvedSubmissions: number; rejectedSubmissions: number };
  participants: Claimer[];
  submissions: CampaignSubmission[];
};

const STRONG_HINTS = new Set<FraudHint["kind"]>(["duplicate-link", "duplicate-answer", "wrong-platform", "x-mismatch"]);

const ICON = "/studio/submissions";
const CARD = "bg-white border-[1.25px] border-[rgba(28,37,51,0.09)] rounded-[40px]";

const STATUS_PILL: Record<LiveStatus, { label: string; text: string; border: string; dot: string }> = {
  Active: { label: "Active", text: "text-[#00a87c]", border: "border-[rgba(0,168,124,0.3)]", dot: "bg-[#00a87c]" },
  Upcoming: { label: "Upcoming", text: "text-[#2f7fe0]", border: "border-[rgba(47,127,224,0.3)]", dot: "bg-[#2f7fe0]" },
  Ended: { label: "Ended", text: "text-[#69728a]", border: "border-[rgba(105,114,138,0.3)]", dot: "bg-[#69728a]" },
};

const REVIEW_PILL = {
  pending: { label: "Pending Review", cls: "bg-[rgba(245,158,11,0.14)] border-[rgba(194,124,0,0.3)] text-[#c27c00]", dot: "bg-[#c27c00]" },
  done: { label: "Approved", cls: "bg-[rgba(0,225,162,0.16)] border-[rgba(0,168,124,0.3)] text-[#00a87c]", dot: "bg-[#00a87c]" },
  retry: { label: "Rejected", cls: "bg-[rgba(248,113,113,0.16)] border-[rgba(228,84,91,0.3)] text-[#e4545b]", dot: "bg-[#e4545b]" },
} as const;

const compact = (n: number) => {
  if (n < 1000) return String(n);
  const v = n / 1000;
  return `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}k`;
};

const fmtDateTime = (iso?: string | null) => {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${d.getFullYear()}, ${time}`;
};

const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());
type Evidence = "Image" | "Link" | "Feedback";
const evidenceOf = (s: CampaignSubmission): Evidence => {
  const v = (s.submissionLink ?? "").trim();
  if (!isUrl(v)) return "Feedback";
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i.test(v) || /amazonaws\.com|cloudinary\.com|ipfs/i.test(v)) return "Image";
  return "Link";
};

const taskTypeLabel = (s: CampaignSubmission) =>
  (s.taskTypeId === "custom" ? "Custom task" : TASK_CATALOG.find(t => t.id === s.taskTypeId)?.name)
  || (s.taskType ? s.taskType.replace(/[-_]/g, " ").replace(/^\w/, c => c.toUpperCase()) : "Task");

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);
const isMissingEndpoint = (err: unknown) => (err as { status?: number })?.status === 404;

function Icon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return <img src={`${ICON}/${name}.svg`} alt="" width={size} height={size} className={cn("shrink-0", className)} />;
}

function Pill({ status }: { status: LiveStatus }) {
  const s = STATUS_PILL[status];
  return (
    <span className={cn("inline-flex items-center gap-[6px] rounded-[20px] border-[1.25px] px-[9px] py-[3px] text-[12px] font-semibold leading-[16.8px]", s.border, s.text,
      status === "Active" ? "bg-[rgba(0,225,162,0.16)]" : "bg-[#f7f4fe]")}>
      <span className={cn("size-[7px] rounded-full", s.dot)} />{s.label}
    </span>
  );
}

function ReviewPill({ status }: { status: TASKS["status"] }) {
  const s = REVIEW_PILL[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-[6px] rounded-[20px] border-[1.25px] px-[9px] py-[3px] text-[12px] font-semibold leading-[16.8px] whitespace-nowrap", s.cls)}>
      <span className={cn("size-[7px] rounded-full", s.dot)} />{s.label}
    </span>
  );
}

function HintChips({ flags }: { flags?: FraudHint[] }) {
  if (!flags?.length) return null;
  return (
    <div className="flex flex-wrap gap-[6px] pt-[6px]">
      {flags.map(f => (
        <span key={f.kind} title={f.label}
          className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            STRONG_HINTS.has(f.kind) ? "bg-[rgba(248,113,113,0.14)] text-[#d63c44]" : "bg-[rgba(245,158,11,0.14)] text-[#b45309]")}>
          <AlertTriangle className="size-3" />{f.label}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ title, body, icon: IconCmp = Inbox }: { title: string; body: string; icon?: typeof Inbox }) {
  return (
    <div className="flex flex-col items-center py-[40px] text-center">
      <span className="grid size-[56px] place-items-center rounded-[16px] bg-[rgba(138,63,252,0.1)]"><IconCmp className="size-[26px] text-[#8B3EFE]" /></span>
      <p className="pt-[16px] text-[18px] font-semibold leading-[20.7px] tracking-[-0.36px] text-[#1c2533]">{title}</p>
      <p className="max-w-[420px] pt-[6px] text-[13.5px] leading-[20.9px] text-[#69728a]">{body}</p>
    </div>
  );
}

const readCampaignParam = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("campaign"));

export default function SubmissionsHub({ refreshKey }: { refreshKey: number }) {
  const [campaignId, setCampaignId] = useState<string | null>(null);

  useEffect(() => {
    setCampaignId(readCampaignParam());
    const onPop = () => setCampaignId(readCampaignParam());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const open = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("campaign", id); else url.searchParams.delete("campaign");
    url.searchParams.delete("queue"); url.searchParams.delete("view");
    window.history.pushState(null, "", url.toString());
    setCampaignId(id);
    scrollToTop();
  };

  return campaignId
    ? <CampaignView campaignId={campaignId} refreshKey={refreshKey} onBack={() => open(null)} />
    : <CampaignList refreshKey={refreshKey} onOpen={open} />;
}

function CampaignList({ refreshKey, onOpen }: { refreshKey: number; onOpen: (id: string) => void }) {
  const [campaigns, setCampaigns] = useState<SubmissionCampaign[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    try {
      const res = await projectApiRequest<{ campaigns?: SubmissionCampaign[] }>({ method: "GET", endpoint: "/hub/submission-campaigns" });
      setCampaigns(res.campaigns ?? []);
      setError("");
    } catch (err) {
      if (quiet) return;
      if (isMissingEndpoint(err)) setCampaigns([]);
      else setError(errorMessage(err, "Campaigns could not be loaded."));
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);
  useLiveRefresh(() => load(true));

  if (!campaigns) return <StudioLoader message="Fetching your campaigns…" error={error} />;

  return (
    <div className="flex flex-col">
      <h1 className="text-[26px] font-semibold leading-[40.3px] tracking-[-0.65px] text-[#1c2533]">Submissions</h1>
      <p className="pt-[5px] text-[14px] leading-[21.7px] text-[#69728a]">Choose a campaign to review its manual-review submissions.</p>
      <h3 className="pt-[22px] text-[18px] font-semibold leading-[20.7px] tracking-[-0.36px] text-[#1c2533]">Campaigns</h3>

      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" body="Once a campaign is live, it shows here with the submissions waiting for your review." />
      ) : (
        <div className="grid gap-[20px] pt-[16px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),390px))]">
          {campaigns.map(c => <CampaignCard key={c._id} c={c} onOpen={() => onOpen(c._id)} />)}
        </div>
      )}
    </div>
  );
}

function CampaignCard({ c, onOpen }: { c: SubmissionCampaign; onOpen: () => void }) {
  const approved = c.approvedSubmissions ?? 0;
  const rejected = c.rejectedSubmissions ?? 0;
  const pending = c.pendingSubmissions;
  const total = c.totalSubmissions || approved + rejected + pending;
  const cover = c.projectCoverImage && c.projectCoverImage !== "pending" ? c.projectCoverImage : null;
  const segments = [
    { n: approved, color: "bg-[#00a87c]" },
    { n: rejected, color: "bg-[#e4545b]" },
    { n: pending, color: "bg-[#c27c00]" },
  ].filter(s => s.n > 0);

  return (
    <button onClick={onOpen} className={cn(CARD, "flex flex-col overflow-hidden text-left transition hover:border-[rgba(138,63,252,0.35)] hover:shadow-[0_8px_24px_rgba(28,37,51,0.06)]")}>
      <div className="relative h-[108px] w-full shrink-0" style={{ backgroundImage: "linear-gradient(164deg, rgb(58,30,110) 0%, rgb(124,92,252) 60%, rgb(63,217,184) 100%)" }}>
        {cover && <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,0.2)] via-[rgba(0,0,0,0)] via-[55%] to-[rgba(0,0,0,0.25)]" />
        <span className="absolute right-[18px] top-[14px]"><Pill status={c.status} /></span>
      </div>
      <div className="flex flex-1 flex-col gap-[16px] p-[22px]">
        <div>
          <p className="truncate text-[19px] font-semibold leading-[22.8px] tracking-[-0.475px] text-[#1c2533]">{c.title}</p>
          <p className="pt-[4px] text-[12.5px] leading-[19.375px] text-[#69728a]">
            {c.isRetention ? "Retention campaign" : "One-time campaign"} · {compact(total)} submission{total === 1 ? "" : "s"} total
          </p>
        </div>
        <div className="flex items-center gap-[14px] rounded-[40px] bg-[rgba(245,158,11,0.14)] px-[16px] py-[14px]">
          <span className="min-w-[38px] text-center text-[32px] font-semibold tracking-[-0.96px] text-[#c27c00]">{compact(pending)}</span>
          <span className="text-[14px] font-semibold leading-[18.2px] text-[#1c2533]">submission{pending === 1 ? "" : "s"} waiting</span>
        </div>
        <div>
          <div className="flex h-[8px] w-full gap-[2px] overflow-hidden rounded-full bg-[#f4f1fc]">
            {segments.map((s, i) => <div key={i} className={cn("h-full", s.color)} style={{ flexGrow: s.n }} />)}
          </div>
          <div className="flex flex-wrap gap-x-[14px] pt-[9px] text-[12px] leading-[18.6px] text-[#69728a]">
            <span className="inline-flex items-center gap-[6px]"><span className="size-[8px] rounded-full bg-[#00a87c]" />{compact(approved)} approved</span>
            <span className="inline-flex items-center gap-[6px]"><span className="size-[8px] rounded-full bg-[#e4545b]" />{compact(rejected)} rejected</span>
            <span className="inline-flex items-center gap-[6px]"><span className="size-[8px] rounded-full bg-[#c27c00]" />{compact(pending)} pending</span>
          </div>
        </div>
        <span className="mt-auto flex h-[48px] w-full items-center justify-center gap-[8px] rounded-full bg-[#8b3efe] text-[14.5px] font-semibold text-white">
          Review submissions <Icon name="arrow-right" />
        </span>
      </div>
    </button>
  );
}

function CampaignView({ campaignId, refreshKey, onBack }: { campaignId: string; refreshKey: number; onBack: () => void }) {
  const [data, setData] = useState<CampaignDetails | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useUrlState<"submissions" | "claimers">("view", "submissions", ["submissions", "claimers"]);
  const [filter, setFilter] = useUrlState<Filter>("queue", "pending", FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    try {
      const res = await projectApiRequest<CampaignDetails>({ method: "GET", endpoint: "/hub/campaign-submission-details", params: { id: campaignId } });
      setData(res);
      setError("");
    } catch (err) {
      if (quiet) return;
      setError(isMissingEndpoint(err) ? "This campaign isn't available at the moment. Please try again later." : errorMessage(err, "The campaign could not be loaded."));
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useLiveRefresh(() => load(true));

  const back = (
    <button onClick={onBack} className="inline-flex h-[34px] items-center gap-[8px] self-start rounded-[8px] text-[13px] font-semibold text-[#3d485c] hover:text-[#1c2533]">
      <Icon name="arrow-left" /> All campaigns
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

  const { campaign: c, stats, submissions: subs } = data;
  const total = subs.length;
  const statCards = [
    { icon: <Icon name="pending" />, label: "Pending", color: "text-[#c27c00]", value: stats.pendingSubmissions, sub: "Waiting for manual review" },
    { icon: <span className="w-[11px] text-[13px] font-semibold leading-[20.15px]">✓</span>, label: "Approved", color: "text-[#00a87c]", value: stats.approvedSubmissions, sub: "Verified by your team" },
    { icon: <Icon name="rejected" />, label: "Rejected", color: "text-[#e4545b]", value: stats.rejectedSubmissions, sub: "Rejected by your team" },
    { icon: <Icon name="total" />, label: "Total submissions", color: "text-[#69728a]", value: total, sub: "Total submissions in this campaign" },
  ];
  const chips: Array<{ id: Filter; label: string }> = [
    { id: "pending", label: `Pending review · ${compact(stats.pendingSubmissions)}` },
    { id: "approved", label: `Approved · ${compact(stats.approvedSubmissions)}` },
    { id: "rejected", label: `Rejected · ${compact(stats.rejectedSubmissions)}` },
    { id: "all", label: `All · ${compact(total)}` },
  ];
  const selected = subs.find(s => s._id === openId) ?? null;

  return (
    <div className="flex flex-col">
      {back}
      <div className="flex flex-wrap items-center gap-[8px] pt-[8px]">
        <h1 className="text-[26px] font-semibold leading-[40.3px] tracking-[-0.65px] text-[#1c2533]">{c.title}</h1>
        <Pill status={c.status} />
      </div>
      <p className="pt-[5px] text-[14px] leading-[21.7px] text-[#69728a]">Review evidence for tasks that can’t be verified automatically.</p>

      <div className="grid grid-cols-1 gap-[20px] pt-[28px] sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(s => (
          <div key={s.label} className={cn(CARD, "flex flex-col p-[18px]")}>
            <span className={cn("flex items-center gap-[7px] text-[12.5px] font-medium leading-[19.375px]", s.color)}>{s.icon}{s.label}</span>
            <span className="pt-[10px] text-[28px] font-semibold leading-[28px] tracking-[-0.56px] text-[#1c2533]">{compact(s.value)}</span>
            <span className="pt-[8px] text-[12.5px] leading-[19.375px] text-[#69728a]">{s.sub}</span>
          </div>
        ))}
      </div>

      <div className="mt-[24px] flex gap-6 border-b-[1.25px] border-[rgba(28,37,51,0.09)]">
        {([
          { id: "submissions", label: "Review queue" },
          { id: "claimers", label: `Claimed reward (${data.participants.length})` },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-1 pb-3 text-[15px] font-semibold transition",
              tab === t.id ? "border-[#8B3EFE] text-[#1c2533]" : "border-transparent text-[#69728a] hover:text-[#1c2533]")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "claimers" ? (
        <div className="pt-[16px]"><ClaimersTable claimers={data.participants} requirement={c.nexuraScoreRequirementPct} /></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-[12px] pt-[20px]">
            <h3 className="text-[18px] font-semibold leading-[20.7px] tracking-[-0.36px] text-[#1c2533]">Review queue</h3>
            <div className="flex flex-wrap items-center gap-[8px]">
              {chips.map(ch => (
                <button key={ch.id} onClick={() => setFilter(ch.id)}
                  className={cn("rounded-full border-[1.25px] px-[16px] py-[7px] text-[13px] font-semibold transition",
                    filter === ch.id ? "border-[#8a3ffc] text-white" : "border-[rgba(28,37,51,0.15)] bg-white text-[#3d485c] hover:bg-[#f7f4fe]")}
                  style={filter === ch.id ? { backgroundImage: "linear-gradient(161deg, rgb(155,124,255) 0%, rgb(124,92,252) 45%, rgb(90,168,255) 100%)" } : undefined}>
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
          <ReviewQueue subs={subs} filter={filter} onOpen={setOpenId} onRefresh={() => load(true)} />
        </>
      )}

      {selected && <ReviewDialog s={selected} onClose={() => setOpenId(null)} onDone={() => { setOpenId(null); load(true); }} />}
    </div>
  );
}

function ReviewQueue({ subs, filter, onOpen, onRefresh }: { subs: CampaignSubmission[]; filter: Filter; onOpen: (id: string) => void; onRefresh: () => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<"accept" | "reject" | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subs.filter(s =>
      (filter === "all" || (filter === "pending" ? s.status === "pending" : filter === "approved" ? s.status === "done" : s.status === "retry")) &&
      (!flaggedOnly || !!s.flags?.length) &&
      (!q || [s.username, s.nexuraUsername, s.submissionLink, s.address].some(v => v?.toLowerCase().includes(q))));
  }, [subs, filter, flaggedOnly, query]);

  const groups = useMemo(() => {
    const byTask = new Map<string, { key: string; title: string; stage: string; stageIndex: number; order: number; items: CampaignSubmission[] }>();
    for (const s of shown) {
      const key = s.questId || s.taskTitle || s.taskType;
      if (!byTask.has(key)) {
        byTask.set(key, { key, title: s.taskTitle || taskTypeLabel(s), stage: s.stageName || "", stageIndex: s.stageIndex ?? Number.MAX_SAFE_INTEGER, order: s.taskOrder ?? 0, items: [] });
      }
      byTask.get(key)!.items.push(s);
    }
    const list = [...byTask.values()].sort((a, b) => a.stageIndex - b.stageIndex || a.order - b.order || a.title.localeCompare(b.title));
    for (const g of list) g.items.sort((a, b) => (filter === "pending" ? 1 : -1) * (new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()));
    return list;
  }, [shown, filter]);

  useEffect(() => {
    const visible = new Set(shown.filter(s => s.status === "pending").map(s => s._id));
    setSelected(prev => {
      const next = new Set([...prev].filter(id => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [shown]);
  useEffect(() => { setConfirmReject(false); }, [selected]);

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const setMany = (ids: string[], on: boolean) => setSelected(prev => {
    const next = new Set(prev);
    ids.forEach(id => (on ? next.add(id) : next.delete(id)));
    return next;
  });
  const toggleGroup = (key: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const runBulk = async (action: "accept" | "reject") => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(action);
    try {
      const res = await projectApiRequest<{ applied: string[]; failed: Array<{ id: string; error: string }> }>({
        method: "POST", endpoint: "/hub/validate-campaign-submissions-bulk", data: { submissionIds: ids, action },
      });
      const verb = action === "accept" ? "approved" : "rejected";
      toast(res.failed.length
        ? { title: `${res.applied.length} ${verb}, ${res.failed.length} not updated`, description: res.failed[0]?.error ? `For example: ${res.failed[0].error}.` : undefined, variant: "destructive" }
        : { title: `${res.applied.length} submission${res.applied.length === 1 ? "" : "s"} ${verb}` });
      setSelected(new Set());
      onRefresh();
    } catch (err) {
      toast({ title: "Couldn't update the submissions", description: errorMessage(err, "Try again shortly."), variant: "destructive" });
    } finally {
      setBulkBusy(null);
      setConfirmReject(false);
    }
  };

  const pendingShown = shown.filter(s => s.status === "pending").map(s => s._id);
  const allSelected = pendingShown.length > 0 && pendingShown.every(id => selected.has(id));
  const flaggedCount = subs.filter(s => s.status === "pending" && s.flags?.length).length;

  return (
    <div className="flex flex-col gap-[12px] pb-[80px] pt-[16px]">
      <div className="flex flex-col gap-[10px] md:flex-row md:items-center md:justify-between">
        {pendingShown.length > 0 ? (
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-[#3d485c]">
            <input type="checkbox" checked={allSelected} onChange={e => setMany(pendingShown, e.target.checked)} className="size-4 accent-[#8B3EFE]" />
            Select all {pendingShown.length} pending
          </label>
        ) : <span />}
        <div className="flex items-center gap-2">
          {flaggedCount > 0 && (
            <button onClick={() => setFlaggedOnly(v => !v)}
              className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border-[1.25px] px-3 text-xs font-semibold transition",
                flaggedOnly ? "border-transparent bg-[#d63c44] text-white" : "border-[rgba(214,60,68,0.35)] bg-white text-[#d63c44] hover:bg-[rgba(248,113,113,0.08)]")}>
              <AlertTriangle className="size-3.5" />Flagged ({flaggedCount})
            </button>
          )}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#98a0b4]" />
            <Input placeholder="Search user, wallet or link" value={query} onChange={e => setQuery(e.target.value)}
              className="h-9 rounded-full border-[rgba(28,37,51,0.15)] bg-white pl-9 text-[#1c2533] placeholder:text-[#98a0b4] focus-visible:ring-[#8a3ffc]" />
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className={CARD}>
          <EmptyState
            title={query || flaggedOnly ? "Nothing matches" : filter === "pending" ? "Nothing to review" : filter === "approved" ? "No approved submissions yet" : filter === "rejected" ? "No rejected submissions yet" : "No submissions yet"}
            body={query || flaggedOnly ? "Try another search or clear the filter." : filter === "pending" ? "Submissions that need a manual check show up here, grouped by task." : "Submissions show up here once they are reviewed."} />
        </div>
      ) : groups.map(g => {
        const open = !collapsed.has(g.key);
        const groupPending = g.items.filter(s => s.status === "pending").map(s => s._id);
        const groupAll = groupPending.length > 0 && groupPending.every(id => selected.has(id));
        const groupFlagged = g.items.filter(s => s.flags?.length).length;
        return (
          <div key={g.key} className={cn(CARD, "px-[26px] py-[4px]")}>
            <div className="flex items-center gap-[12px] py-[16px]">
              {groupPending.length > 0 && (
                <input type="checkbox" checked={groupAll} onChange={e => setMany(groupPending, e.target.checked)}
                  title="Select every pending submission for this task" className="size-4 shrink-0 accent-[#8B3EFE]" />
              )}
              <button onClick={() => toggleGroup(g.key)} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                <div className="min-w-0">
                  {g.stage && <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a3ffc]">{g.stageIndex !== Number.MAX_SAFE_INTEGER ? `Stage ${g.stageIndex + 1} · ` : ""}{g.stage}</p>}
                  <p className="truncate text-[15px] font-semibold text-[#1c2533]">{g.title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {groupFlagged > 0 && <span className="rounded-full bg-[rgba(248,113,113,0.14)] px-2.5 py-0.5 text-[11px] font-semibold text-[#d63c44]">{groupFlagged} flagged</span>}
                  <span className="rounded-full bg-[#f7f4fe] px-2.5 py-0.5 text-[11px] font-semibold text-[#3d485c]">{g.items.length} submission{g.items.length === 1 ? "" : "s"}</span>
                  <ChevronDown className={cn("size-4 text-[#98a0b4] transition-transform", open && "rotate-180")} />
                </div>
              </button>
            </div>
            {open && g.items.map(s => (
              <div key={s._id} className={cn("flex flex-wrap items-center gap-[14px] border-t-[1.25px] border-[rgba(28,37,51,0.09)] py-[16px] sm:flex-nowrap", selected.has(s._id) && "bg-[rgba(138,63,252,0.04)]")}>
                {s.status === "pending"
                  ? <input type="checkbox" checked={selected.has(s._id)} onChange={() => toggle(s._id)} className="size-4 shrink-0 accent-[#8B3EFE]" />
                  : groupPending.length > 0 && <span className="w-4 shrink-0" />}
                <span className="grid size-[36px] shrink-0 place-items-center rounded-full bg-[rgba(138,63,252,0.1)]"><Icon name="eye" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-[10px]">
                    <span className="rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.09)] bg-[#f4f1fc] px-[9px] py-[4px] font-mono text-[12px] leading-[18.6px] text-[#1c2533]">
                      {s.nexuraUsername || s.username || "unnamed"}
                    </span>
                    <span className="min-w-0 text-[14px] leading-[21.7px] text-[#1c2533]">
                      Submitted <b className="font-bold">{s.stageIndex != null ? `Stage ${s.stageIndex + 1} · ` : ""}{s.taskTitle || taskTypeLabel(s)}</b>
                    </span>
                  </div>
                  <p className="pt-[4px] text-[12.5px] leading-[19.375px] text-[#69728a]">{fmtDateTime(s.createdAt)} · {evidenceOf(s)}</p>
                  <HintChips flags={s.flags} />
                </div>
                <ReviewPill status={s.status} />
                <button onClick={() => onOpen(s._id)}
                  className={cn("h-[36px] shrink-0 rounded-full border-[1.25px] px-[16px] text-[13px] font-semibold transition",
                    s.status === "pending" ? "border-[#8a3ffc] bg-[#8b3efe] text-white hover:bg-[#7b35e6]" : "border-[rgba(28,37,51,0.15)] bg-white text-[#1c2533] hover:bg-[#f7f4fe]")}>
                  {s.status === "pending" ? "Review" : "View"}
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-center gap-2 self-center rounded-full bg-[#1c2533] px-4 py-3 text-white shadow-[0_12px_32px_rgba(28,37,51,0.35)]">
          <span className="px-2 text-[13px] font-semibold">{selected.size} selected</span>
          <button disabled={!!bulkBusy} onClick={() => runBulk("accept")}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#00a87c] px-4 text-[12.5px] font-semibold hover:bg-[#009670] disabled:opacity-60">
            <Check className="size-3.5" />{bulkBusy === "accept" ? "Approving…" : "Approve all"}
          </button>
          <button disabled={!!bulkBusy} onClick={() => (confirmReject ? runBulk("reject") : setConfirmReject(true))}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#e4545b] px-4 text-[12.5px] font-semibold hover:bg-[#d4444b] disabled:opacity-60">
            {bulkBusy === "reject" ? "Rejecting…" : confirmReject ? `Confirm reject ${selected.size}` : "Reject all"}
          </button>
          <button disabled={!!bulkBusy} onClick={() => setSelected(new Set())} className="h-8 rounded-full px-3 text-[12.5px] font-semibold text-white/80 hover:text-white disabled:opacity-60">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

const fmtDate = (iso?: string | null) => {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No date";
};
const shortAddress = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "No wallet");
const retentionColor = (r: number | null) => (r === null ? "#98a0b4" : r >= 75 ? "#00a87c" : r >= 40 ? "#c27c00" : "#e4545b");

function RetentionCell({ rate, detail, below }: { rate: number | null; detail: string; below?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold" style={{ color: retentionColor(rate) }}>
        {rate === null ? "No data yet" : `${rate}%`}
        <span className="font-medium text-[#98a0b4]"> · {detail}</span>
        {below && <span className="font-medium text-[#e4545b]"> · below target</span>}
      </span>
      {rate !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f1edfb]"><div className="h-full rounded-full" style={{ width: `${rate}%`, background: retentionColor(rate) }} /></div>
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
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#98a0b4]" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by username or wallet"
            className="h-10 rounded-full border-[rgba(28,37,51,0.15)] bg-white pl-10 text-[#1c2533] placeholder:text-[#98a0b4] focus-visible:ring-[#8a3ffc]" />
        </div>
        {requirement !== null && (
          <button onClick={() => setBelowOnly(v => !v)}
            className={cn("h-8 self-start rounded-full border-[1.25px] px-3 text-xs font-semibold transition md:self-auto",
              belowOnly ? "border-transparent bg-[#8B3EFE] text-white" : "border-[rgba(28,37,51,0.15)] bg-white text-[#3d485c] hover:bg-[#f7f4fe]")}>
            Below {requirement}% Nexura score
          </button>
        )}
      </div>

      <div className={cn(CARD, "overflow-hidden rounded-[28px]")}>
        <div className={cn("grid grid-cols-2 gap-x-4 gap-y-1 border-b-[1.25px] border-[rgba(28,37,51,0.09)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a0b4]", cols)}>
          <span>Nexura username</span><span>Wallet address</span><span>Campaign retention</span><span>Nexura score</span><span>Claimed on</span><span className="hidden md:block" />
        </div>
        {shown.length === 0 ? (
          claimers.length === 0
            ? <EmptyState icon={Users} title="No claims yet" body="Each person who completes this campaign and claims the reward is listed here." />
            : <EmptyState icon={Search} title="No one matches" body="Try another username or wallet address." />
        ) : shown.map(p => {
          const open = expanded === p.userId;
          return (
            <div key={p.userId} className="border-b-[1.25px] border-[rgba(28,37,51,0.06)] last:border-b-0">
              <button onClick={() => setExpanded(open ? null : p.userId)}
                className={cn("grid w-full grid-cols-1 items-center gap-3 px-5 py-4 text-left transition hover:bg-[#fbfaff] md:gap-4", cols)}>
                <div className="flex min-w-0 items-center gap-3">
                  {p.profilePic ? (
                    <img src={p.profilePic} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[rgba(138,63,252,0.12)] text-sm font-semibold text-[#8a3ffc]">
                      {(p.username || "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1c2533]">{p.username || "Unnamed user"}</p>
                    <p className="text-[11px] text-[#98a0b4]">Joined {fmtDate(p.joinedAt)} · {p.tasksDone}/{p.totalTasks} tasks</p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-xs text-[#3d485c]" title={p.address}>{shortAddress(p.address)}</span>
                  {p.address && (
                    <span role="button" tabIndex={0} title="Copy wallet address"
                      onClick={e => { e.stopPropagation(); copy(p.address); }}
                      onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); copy(p.address); } }}
                      className="inline-flex size-6 items-center justify-center rounded-full text-[#69728a] hover:bg-[#efeafb]">
                      {copied === p.address ? <Check className="size-3.5 text-[#00a87c]" /> : <Copy className="size-3.5" />}
                    </span>
                  )}
                </div>
                <RetentionCell rate={p.retentionRate} detail={`${p.stagesCompleted}/${p.stagesTotal} stages`} />
                <RetentionCell rate={p.nexuraScore} below={p.meetsRequirement === false} detail={p.nexuraScoreCampaigns ? `${p.nexuraScoreCampaigns} campaign${p.nexuraScoreCampaigns === 1 ? "" : "s"}` : "no finished campaigns"} />
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[rgba(0,225,162,0.16)] px-2.5 py-1 text-[11px] font-semibold text-[#00a87c]">
                  <CheckCircle2 className="size-3.5" /> {fmtDate(p.claimedAt)}
                </span>
                <ChevronDown className={cn("hidden size-4 text-[#98a0b4] transition-transform md:block", open && "rotate-180")} />
              </button>

              {open && (
                <div className="px-5 pb-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a0b4]">Retention history</p>
                  {p.history.length === 0 ? (
                    <p className="text-xs text-[#69728a]">This campaign has no tasks yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {p.history.map((h, i) => (
                        <div key={h.key} className="flex items-center gap-3 rounded-2xl bg-[#f7f4fe] px-4 py-3">
                          <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full",
                            h.status === "completed" ? "bg-[rgba(0,225,162,0.16)] text-[#00a87c]" : h.status === "in-progress" ? "bg-[rgba(245,158,11,0.14)] text-[#c27c00]" : "bg-white text-[#98a0b4]")}>
                            {h.status === "completed" ? <Check className="size-4" /> : h.status === "in-progress" ? <Clock className="size-4" /> : <Lock className="size-3.5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#1c2533]"><span className="mr-1.5 text-[#8a3ffc]">Stage {i + 1}</span>{h.name}</p>
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
      </div>
    </div>
  );
}

function ReviewDialog({ s, onClose, onDone }: { s: CampaignSubmission; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [fullImage, setFullImage] = useState(false);
  const evidence = evidenceOf(s);
  const value = (s.submissionLink ?? "").trim();
  const pending = s.status === "pending";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") (fullImage ? setFullImage(false) : onClose()); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullImage, onClose]);

  const decide = async (action: "accept" | "reject") => {
    setBusy(action);
    try {
      await projectApiRequest({ method: "POST", endpoint: "/hub/validate-campaign-submissions", data: { submissionId: s._id, action, note: action === "reject" ? note.trim() : undefined } });
      toast({ title: action === "accept" ? "Submission approved" : "Submission rejected" });
      onDone();
    } catch (err) {
      toast({ title: "Couldn't update the submission", description: errorMessage(err, "Try again shortly."), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const label = "text-[11.5px] font-semibold uppercase leading-[17.825px] tracking-[0.805px] text-[#1c2533]";
  const body = "text-[13.5px] leading-[21.6px] text-[#3d485c]";
  const chip = "rounded-full border-[1.25px] border-[rgba(28,37,51,0.09)] bg-[#f4f1fc] px-[10px] py-[4px] text-[12px] leading-[18.6px] text-[#3d485c]";
  const btn = "flex min-h-[40px] items-center justify-center gap-[8px] rounded-[40px] border-[1.25px] px-[16px] py-[10px] text-[14px] font-semibold transition disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,3,9,0.7)] p-[20px] backdrop-blur-[4px]" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal className="flex max-h-full w-full max-w-[513px] flex-col rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.15)] bg-white shadow-[0px_22px_25px_rgba(28,37,51,0.28)]">
        <div className="flex items-start justify-between px-[24px] pt-[22px]">
          <p className="text-[16.38px] font-semibold leading-[18.837px] tracking-[-0.3276px] text-[#1c2533]">Review submission</p>
          <button onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-[24px] py-[16px]">
          <div className="flex flex-wrap items-center gap-[8px]">
            <ReviewPill status={s.status} />
            <span className={chip}>Submitted: {fmtDateTime(s.createdAt)}</span>
          </div>
          <p className="pt-[16px] text-[15px] font-semibold leading-[23.25px] text-[#1c2533]">Task Type</p>
          <p className={cn(body, "pt-[2px]")}>{taskTypeLabel(s)}</p>

          <div className="flex items-center gap-[10px] pt-[14px]">
            <span className={label}>Evidence upload</span>
            <span className={cn(chip, "font-semibold")}>{evidence}</span>
          </div>
          <div className="pt-[10px]">
            {evidence === "Image" ? (
              <div className="relative h-[200px] w-full overflow-hidden rounded-[40px] border-[1.25px] border-dashed border-[rgba(28,37,51,0.15)]">
                <img src={value} alt="Submitted evidence" className="size-full object-cover" />
                <button onClick={() => setFullImage(true)} className="absolute bottom-[12px] right-[16px] flex items-center gap-[6px] rounded-full bg-[rgba(28,37,51,0.78)] px-[13px] py-[7px] text-[13.333px] text-white backdrop-blur-[6px]">
                  <Icon name="expand" size={14} className="-rotate-45" /> Expand
                </button>
              </div>
            ) : evidence === "Link" ? (
              <div className="flex h-[48px] items-center gap-[8px] overflow-hidden rounded-[40px] border border-[#9b7cff] bg-[#f4f7ff] px-[12.667px]">
                <span className="min-w-0 flex-1 truncate text-[13px] text-[#605d72]">{value}</span>
                <a href={value} target="_blank" rel="noopener noreferrer" aria-label="Open link"><Icon name="external-link" size={30} /></a>
              </div>
            ) : (
              <div className="max-h-[213px] min-h-[120px] overflow-y-auto whitespace-pre-wrap break-words rounded-[40px] border border-[#9b7cff] bg-[#f4f7ff] px-[16px] py-[14px] text-[13.2px] leading-[20.46px] text-[#605d72]">
                {value || "No answer"}
              </div>
            )}
          </div>

          {s.taskTitle && (
            <>
              <p className={cn(label, "pt-[16px]")}>Task requirement</p>
              <p className={cn(body, "pt-[6px]")}>{s.taskTitle}</p>
            </>
          )}

          {!pending && (
            <div className={cn("mt-[16px] flex items-center gap-[12px] rounded-[40px] border-[1.25px] p-[14px]",
              s.status === "done" ? "border-[rgba(0,170,125,0.35)] bg-[rgba(0,225,162,0.1)]" : "border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.1)]")}>
              <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-white">
                <Icon name={s.status === "done" ? "approved-badge" : "rejected-badge"} size={18} />
              </span>
              <div className="min-w-0">
                <p className={cn("text-[15px] font-bold leading-[23.25px]", s.status === "done" ? "text-[#007a59]" : "text-[#c23b3b]")}>
                  {s.status === "done" ? "Approved" : "Rejected"}
                </p>
                <p className="text-[12.5px] leading-[19.375px] text-[#3d485c]">
                  by {s.validatedBy || "your team"}{s.reviewedAt ? ` on ${fmtDateTime(s.reviewedAt)}` : ""}.
                </p>
                {s.status === "retry" && s.reviewNote && <p className="pt-[4px] text-[12.5px] leading-[19.375px] text-[#3d485c]">“{s.reviewNote}”</p>}
              </div>
            </div>
          )}

          {pending && rejecting && (
            <div className="flex flex-col gap-[7px] pt-[16px]">
              <label htmlFor="review-note" className="text-[13px] font-semibold leading-[20.15px] text-[#3d485c]">
                Note to the participant <span className="font-normal text-[rgba(61,72,92,0.7)]">(optional)</span>
              </label>
              <textarea id="review-note" value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Add a note to help them fix it"
                className="min-h-[96px] w-full resize-none rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.15)] bg-[#f4f1fc] px-[20px] py-[18px] text-[14px] leading-[21px] text-[#1c2533] outline-none placeholder:text-[#98a0b4] focus:border-[#8a3ffc]" />
              <p className="text-[12.5px] leading-[18.75px] text-[#69728a]">The participant will see this note. The campaign rules allow them to resubmit.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-[10px] px-[24px] pb-[22px] pt-[16px]">
          {!pending ? (
            <button onClick={onClose} className={cn(btn, "border-[rgba(28,37,51,0.15)] bg-[#f7f4fe] text-[#1c2533] hover:bg-[#efeafb]")}>Close</button>
          ) : rejecting ? (
            <>
              <button onClick={() => setRejecting(false)} disabled={!!busy} className={cn(btn, "border-[rgba(28,37,51,0.15)] bg-[#f7f4fe] text-[#1c2533] hover:bg-[#efeafb]")}>Cancel</button>
              <button onClick={() => decide("reject")} disabled={!!busy} className={cn(btn, "border-[rgba(228,84,91,0.34)] text-[#e4545b] hover:bg-[rgba(248,113,113,0.08)]")}>
                {busy === "reject" ? "Rejecting…" : "Confirm rejection"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setRejecting(true)} disabled={!!busy} className={cn(btn, "border-[rgba(228,84,91,0.34)] text-[#e4545b] hover:bg-[rgba(248,113,113,0.08)]")}>Reject</button>
              <button onClick={() => decide("accept")} disabled={!!busy} className={cn(btn, "border-transparent bg-[#8b3efe] text-white shadow-[0px_8px_11px_rgba(138,63,252,0.25)] hover:bg-[#7b35e6]")}>
                <Icon name="check" /> {busy === "accept" ? "Approving…" : "Approve"}
              </button>
            </>
          )}
        </div>
      </div>

      {fullImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(4,3,9,0.91)] p-[20px] backdrop-blur-[4px]" onMouseDown={e => { if (e.target === e.currentTarget) setFullImage(false); }}>
          <img src={value} alt="Submitted evidence" className="max-h-full max-w-full rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.15)] object-contain" />
          <button onClick={() => setFullImage(false)} aria-label="Close full screen"
            className="absolute right-[16px] top-[16px] grid size-[40px] place-items-center rounded-[20px] bg-[rgba(255,255,255,0.19)] text-[18px] font-semibold text-white">✕</button>
        </div>
      )}
    </div>
  );
}
