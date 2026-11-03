"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ExternalLink, Eye, Inbox, RefreshCw, Search, X } from "lucide-react";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { projectApiRequest } from "../../lib/projectApi";
import { useToast } from "../../hooks/use-toast";
import { useUrlState } from "../../hooks/use-url-state";
import { TASKS } from "../../types/admin";
import StudioLoader from "../studio/StudioLoader";

export type FraudHint = {
  kind: "duplicate-link" | "duplicate-answer" | "wrong-platform" | "short-answer" | "x-mismatch" | "no-x-linked" | "new-account" | "rejected-before";
  label: string;
};

/** A campaign submission as /hub/campaign-submission-details returns it. */
export type CampaignSubmission = TASKS & {
  taskTitle?: string;
  nexuraUsername?: string;
  address?: string;
  rejectedCount?: number;
  questId?: string;
  stageIndex?: number | null;
  stageName?: string;
  taskOrder?: number;
  flags?: FraudHint[];
};

interface CampaignSubmissionsProps {
  tasks: CampaignSubmission[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  handleView: (id: string, taskType: string, link: string) => void;
  handleAction: (id: string, action: "accept" | "reject") => void;
  onRefresh: () => void;
}

type View = "pending" | "reviewed";

// Strong hints are shown in red, the rest in amber
const STRONG_HINTS = new Set<FraudHint["kind"]>(["duplicate-link", "duplicate-answer", "wrong-platform", "x-mismatch"]);

const timeAgo = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const isUrl = (v: string) => /^https?:\/\//i.test(v.trim());
const shortLink = (v: string) => v.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

function HintChips({ flags }: { flags?: FraudHint[] }) {
  if (!flags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map(f => (
        <span key={f.kind} title={f.label}
          className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            STRONG_HINTS.has(f.kind) ? "bg-[rgba(248,113,113,0.14)] text-[#d63c44]" : "bg-[rgba(245,158,11,0.14)] text-[#b45309]")}>
          <AlertTriangle className="w-3 h-3" />{f.label}
        </span>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: TASKS["status"] }) {
  const style = status === "done" ? "bg-[rgba(0,225,162,0.16)] text-[#00a87c]"
    : status === "retry" ? "bg-[rgba(248,113,113,0.16)] text-[#e4545b]"
    : "bg-[rgba(245,158,11,0.14)] text-[#c27c00]";
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", style)}>{status === "done" ? "Approved" : status === "retry" ? "Rejected" : "Pending"}</span>;
}

export default function CampaignSubmissions({ tasks, loading, searchTerm, setSearchTerm, handleView, handleAction, onRefresh }: CampaignSubmissionsProps) {
  const { toast } = useToast();
  const [view, setView] = useUrlState<View>("review", "pending", ["pending", "reviewed"]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<"accept" | "reject" | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const counts = useMemo(() => ({
    pending: tasks.filter(t => t.status === "pending").length,
    reviewed: tasks.filter(t => t.status !== "pending").length,
    flagged: tasks.filter(t => t.status === "pending" && t.flags?.length).length,
  }), [tasks]);

  const shown = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return tasks.filter(t =>
      (view === "pending" ? t.status === "pending" : t.status !== "pending") &&
      (!flaggedOnly || !!t.flags?.length) &&
      (!q || [t.username, t.nexuraUsername, t.submissionLink, t.address].some(v => v?.toLowerCase().includes(q))));
  }, [tasks, view, flaggedOnly, searchTerm]);

  // One group per task, in campaign order (stage, then position in the stage)
  const groups = useMemo(() => {
    const byTask = new Map<string, { key: string; title: string; stage: string; stageIndex: number; order: number; items: CampaignSubmission[] }>();
    for (const t of shown) {
      const key = t.questId || t.taskTitle || t.taskType;
      if (!byTask.has(key)) {
        byTask.set(key, {
          key, title: t.taskTitle || t.taskType, stage: t.stageName || "",
          stageIndex: t.stageIndex ?? Number.MAX_SAFE_INTEGER, order: t.taskOrder ?? 0, items: [],
        });
      }
      byTask.get(key)!.items.push(t);
    }
    const list = [...byTask.values()].sort((a, b) => a.stageIndex - b.stageIndex || a.order - b.order || a.title.localeCompare(b.title));
    // Oldest first while reviewing, so nobody waits longest
    for (const g of list) g.items.sort((a, b) => (view === "pending" ? 1 : -1) * (new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()));
    return list;
  }, [shown, view]);

  // Selection only holds pending submissions that are still on screen
  useEffect(() => {
    const visible = new Set(shown.filter(t => t.status === "pending").map(t => t._id));
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
      toast({ title: "Couldn't update the submissions", description: err instanceof Error ? err.message : "Try again shortly.", variant: "destructive" });
    } finally {
      setBulkBusy(null);
      setConfirmReject(false);
    }
  };

  const pendingShown = shown.filter(t => t.status === "pending").map(t => t._id);
  const allSelected = pendingShown.length > 0 && pendingShown.every(id => selected.has(id));

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Header: view switch, search, refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex self-start rounded-full bg-white border-[0.833px] border-[rgba(28,37,51,0.12)] p-1">
          {([["pending", `Needs review (${counts.pending})`], ["reviewed", `Reviewed (${counts.reviewed})`]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={cn("h-8 px-4 rounded-full text-[13px] font-semibold transition",
                view === v ? "bg-[#8B3EFE] text-white" : "text-[#3d485c] hover:bg-[#f7f4fe]")}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {counts.flagged > 0 && view === "pending" && (
            <button onClick={() => setFlaggedOnly(v => !v)}
              className={cn("h-9 px-3 rounded-full text-xs font-semibold border-[0.833px] transition inline-flex items-center gap-1.5 shrink-0",
                flaggedOnly ? "bg-[#d63c44] text-white border-transparent" : "bg-white text-[#d63c44] border-[rgba(214,60,68,0.35)] hover:bg-[rgba(248,113,113,0.08)]")}>
              <AlertTriangle className="w-3.5 h-3.5" />Flagged ({counts.flagged})
            </button>
          )}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98a0b4]" />
            <Input placeholder="Search user, wallet or link" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="bg-white border-[rgba(28,37,51,0.15)] text-[#1c2533] pl-9 placeholder:text-[#98a0b4] rounded-full focus-visible:ring-[#8a3ffc] h-9" />
          </div>
          <button onClick={onRefresh} disabled={loading} title="Refresh"
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full text-[#3d485c] hover:bg-[#efeafb] disabled:opacity-50">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {view === "pending" && pendingShown.length > 0 && (
        <label className="inline-flex items-center gap-2 self-start text-[13px] font-medium text-[#3d485c] cursor-pointer select-none">
          <input type="checkbox" checked={allSelected} onChange={e => setMany(pendingShown, e.target.checked)} className="size-4 accent-[#8B3EFE]" />
          Select all {pendingShown.length} shown
        </label>
      )}

      {loading && tasks.length === 0 ? (
        <StudioLoader compact message="Loading submissions…" />
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <span className="grid place-items-center size-14 rounded-2xl bg-[rgba(138,63,252,0.1)] text-[#8a3ffc]"><Inbox className="w-6 h-6" /></span>
          <p className="mt-4 text-[16px] font-semibold text-[#1c2533]">
            {searchTerm || flaggedOnly ? "Nothing matches" : view === "pending" ? "Nothing to review" : "No reviewed submissions yet"}
          </p>
          <p className="mt-1 text-[13px] text-[#69728a] max-w-sm">
            {searchTerm || flaggedOnly ? "Try another search or clear the filter."
              : view === "pending" ? "Submissions that need a manual check show up here, grouped by task." : "Approved and rejected submissions show up here."}
          </p>
        </div>
      ) : (
        groups.map(g => {
          const open = !collapsed.has(g.key);
          const groupPending = g.items.filter(t => t.status === "pending").map(t => t._id);
          const groupAll = groupPending.length > 0 && groupPending.every(id => selected.has(id));
          const groupFlagged = g.items.filter(t => t.flags?.length).length;
          return (
            <Card key={g.key} className="bg-white border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[28px] shadow-none overflow-hidden">
              {/* Task header */}
              <div className="flex items-center gap-3 px-5 py-4">
                {view === "pending" && (
                  <input type="checkbox" checked={groupAll} onChange={e => setMany(groupPending, e.target.checked)}
                    title="Select every submission for this task" className="size-4 accent-[#8B3EFE] shrink-0" />
                )}
                <button onClick={() => toggleGroup(g.key)} className="flex-1 min-w-0 flex items-center justify-between gap-3 text-left">
                  <div className="min-w-0">
                    {g.stage && <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a3ffc]">{g.stage}</p>}
                    <p className="text-[15px] font-semibold text-[#1c2533] truncate">{g.title}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {groupFlagged > 0 && <span className="rounded-full bg-[rgba(248,113,113,0.14)] text-[#d63c44] px-2.5 py-0.5 text-[11px] font-semibold">{groupFlagged} flagged</span>}
                    <span className="rounded-full bg-[#f7f4fe] text-[#3d485c] px-2.5 py-0.5 text-[11px] font-semibold">
                      {g.items.length} {view === "pending" ? "to review" : "reviewed"}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 text-[#98a0b4] transition-transform", open && "rotate-180")} />
                  </div>
                </button>
              </div>

              {open && g.items.map(t => {
                const feedback = !isUrl(t.submissionLink);
                const isSelected = selected.has(t._id);
                return (
                  <div key={t._id}
                    className={cn("flex flex-col md:flex-row md:items-center gap-3 px-5 py-3 border-t-[0.833px] border-[rgba(28,37,51,0.06)] transition",
                      isSelected ? "bg-[rgba(138,63,252,0.05)]" : "hover:bg-[#fbfaff]")}>
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {t.status === "pending" && (
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(t._id)} className="mt-1 size-4 accent-[#8B3EFE] shrink-0" />
                      )}
                      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#1c2533]">{t.username || t.nexuraUsername || "Unnamed user"}</span>
                          {t.nexuraUsername && t.username && t.nexuraUsername !== t.username && <span className="text-[11px] text-[#98a0b4]">Nexura: {t.nexuraUsername}</span>}
                          <span className="text-[11px] text-[#98a0b4]">· {timeAgo(t.createdAt)}</span>
                          {view === "reviewed" && <StatusPill status={t.status} />}
                          {view === "reviewed" && t.validatedBy && <span className="text-[11px] text-[#98a0b4]">by {t.validatedBy}</span>}
                        </div>
                        {feedback || !/^https?:\/\//i.test(t.submissionLink.trim()) ? (
                          <p className="text-[13px] text-[#3d485c] bg-[#f7f4fe] rounded-2xl px-3 py-2 whitespace-pre-wrap break-words line-clamp-3">{t.submissionLink}</p>
                        ) : (
                          <a href={t.submissionLink} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[13px] text-[#6e2bd8] hover:underline min-w-0 max-w-full">
                            <span className="truncate">{shortLink(t.submissionLink)}</span><ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          </a>
                        )}
                        <HintChips flags={t.flags} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:shrink-0 pl-7 md:pl-0">
                      <button onClick={() => handleView(t._id, t.taskType, t.submissionLink)} title="Open the submission"
                        className="h-8 px-3 rounded-full text-[12.5px] font-semibold text-[#3d485c] bg-[#f7f4fe] border-[0.833px] border-[rgba(28,37,51,0.12)] hover:bg-[#efeafb] inline-flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />View
                      </button>
                      {t.status === "pending" && (
                        <>
                          <button onClick={() => handleAction(t._id, "accept")} title="Approve"
                            className="h-8 px-3 rounded-full text-[12.5px] font-semibold bg-[rgba(0,225,162,0.16)] text-[#00875a] hover:bg-[rgba(0,225,162,0.26)] inline-flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />Approve
                          </button>
                          <button onClick={() => handleAction(t._id, "reject")} title="Reject"
                            className="h-8 px-3 rounded-full text-[12.5px] font-semibold bg-[rgba(248,113,113,0.14)] text-[#d63c44] hover:bg-[rgba(248,113,113,0.24)] inline-flex items-center gap-1.5">
                            <X className="w-3.5 h-3.5" />Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          );
        })
      )}

      {/* Bulk actions for the selected submissions */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 self-center flex flex-wrap items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#1c2533] text-white shadow-[0_12px_32px_rgba(28,37,51,0.35)]">
          <span className="text-[13px] font-semibold px-2">{selected.size} selected</span>
          <button disabled={!!bulkBusy} onClick={() => runBulk("accept")}
            className="h-8 px-4 rounded-full text-[12.5px] font-semibold bg-[#00a87c] hover:bg-[#009670] disabled:opacity-60 inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />{bulkBusy === "accept" ? "Approving…" : "Approve all"}
          </button>
          <button disabled={!!bulkBusy} onClick={() => (confirmReject ? runBulk("reject") : setConfirmReject(true))}
            className="h-8 px-4 rounded-full text-[12.5px] font-semibold bg-[#e4545b] hover:bg-[#d4444b] disabled:opacity-60 inline-flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" />{bulkBusy === "reject" ? "Rejecting…" : confirmReject ? `Confirm reject ${selected.size}` : "Reject all"}
          </button>
          <button disabled={!!bulkBusy} onClick={() => setSelected(new Set())} className="h-8 px-3 rounded-full text-[12.5px] font-semibold text-white/80 hover:text-white disabled:opacity-60">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
