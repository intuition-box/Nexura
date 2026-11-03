"use client";
import StudioLoader from "@/components/studio/StudioLoader";

import { useEffect, useState, useCallback } from "react";
import { useUrlState } from "../../hooks/use-url-state";
import { useLiveRefresh } from "../../hooks/use-live-refresh";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, XCircle, Trash2, Loader2, Clock } from "lucide-react";
import { Card } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { projectApiRequest } from "../../lib/projectApi";
import { userApiRequest } from "../../lib/userApi";
import { useToast } from "../../hooks/use-toast";
import { getStoredUserSession } from "../../lib/userSession";
import { apiRequestV2 } from "../../lib/queryClient";
import { Button } from "../ui/button";
import CreatorRewardsBanner from "../CreatorRewardsBanner";

interface Quest {
  _id: string;
  title: string;
  description?: string;
  starts_at: string;
  ends_at: string;
  projectCoverImage?: string;
  reward?: { pool?: number };
  status?: string;
}

type PendingAction = { type: "delete" | "close"; id: string; title: string } | null;

function getApiConfig() {
  const session = getStoredUserSession();
  console.log("[QuestsTab] Session:", session);
  const result = {
    apiPrefix: session?.type === "user" ? "user-hub" : "hub",
    apiRequest: session?.type === "user" ? userApiRequest : projectApiRequest,
  };
  console.log("[QuestsTab] API Config:", result);
  return result;
}

const QUEST_TABS = ["all", "active", "scheduled", "drafts", "completed"] as const;

export default function QuestsTab() {
  const [activeTab, setActiveTab] = useUrlState("tab", "all", QUEST_TABS);
  const [serverOffset, setServerOffset] = useState(0);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const router = useRouter();
  const { toast } = useToast();

  const session = getStoredUserSession();
  const isUser = session?.type === "user";

  /** `quiet` refreshes in the background, without the loading state or error toasts. */
  const fetchQuests = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const { apiPrefix, apiRequest } = getApiConfig();
      const res = await apiRequest<{ quests?: Quest[]; hubQuests?: Quest[] }>({
        method: "GET",
        endpoint: `/${apiPrefix}/get-quests`,
      });
      setQuests(res.quests ?? res.hubQuests ?? []);
    } catch (err: any) {
      if (quiet) return;
      toast({
        title: "Fetch failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  useLiveRefresh(() => fetchQuests(true));

  // Server time sync
  useEffect(() => {
    apiRequestV2("GET", `/api/server-time`)
      .then((res: any) => setServerOffset(res.serverTime - Date.now()))
      .catch(() => {});
  }, []);

  const nowMs = Date.now() + serverOffset;

  const isDraft = (c: Quest) => c.status === "Save";
  const isCompleted = (c: Quest) =>
    c.status === "Ended" || (!!c.ends_at && new Date(c.ends_at).getTime() <= nowMs);
  const isScheduled = (c: Quest) => {
    if (c.status === "Scheduled") return true;
    if (isDraft(c) || isCompleted(c)) return false;
    return !!c.starts_at && new Date(c.starts_at).getTime() > nowMs;
  };
  const isActive = (c: Quest) =>
    !isDraft(c) && !isCompleted(c) && !isScheduled(c);

  // Countdown timer
  useEffect(() => {
    const scheduled = quests.filter(isScheduled);
    if (scheduled.length === 0) return;
    const tick = () => {
      const n = Date.now() + serverOffset;
      const newCountdowns: Record<string, string> = {};
      let anyExpired = false;
      for (const q of scheduled) {
        const diff = new Date(q.starts_at!).getTime() - n;
        if (diff <= 0) {
          anyExpired = true;
          newCountdowns[q._id] = "Starting...";
        } else {
          const d = Math.floor(diff / 86400000);
          const h = Math.floor((diff % 86400000) / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          newCountdowns[q._id] = d > 0 ? `${d}d ${h}h ${m}m ${s}s` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
        }
      }
      setCountdowns(newCountdowns);
      if (anyExpired) fetchQuests();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [quests, serverOffset, fetchQuests]);

  const filteredQuests = quests.filter((c) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return isActive(c);
    if (activeTab === "scheduled") return isScheduled(c);
    if (activeTab === "drafts") return isDraft(c);
    if (activeTab === "completed") return isCompleted(c);
    return true;
  });

  const tabs = [
    { id: "all", label: "All Quests", count: quests.length },
    { id: "active", label: "Active", count: quests.filter(isActive).length },
    { id: "scheduled", label: "Upcoming", count: quests.filter(isScheduled).length },
    { id: "drafts", label: "Drafts", count: quests.filter(isDraft).length },
    { id: "completed", label: "Completed", count: quests.filter(isCompleted).length },
  ];

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setPendingAction(null);
    try {
      const { apiPrefix, apiRequest } = getApiConfig();
      // Send ID in both query and body for maximum compatibility with backend extraction
      await apiRequest({ 
        method: "DELETE", 
        endpoint: `/${apiPrefix}/delete-quest?id=${id}`, 
        data: { id, questId: id } 
      });
      setQuests((prev) => prev.filter((q) => q._id !== id));
      toast({ title: "Quest deleted", description: "The quest has been removed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleClose = async (id: string) => {
    setClosingId(id);
    setPendingAction(null);
    try {
      const { apiPrefix, apiRequest } = getApiConfig();
      // Send ID in both query and body for maximum compatibility with backend extraction
      await apiRequest({ 
        method: "PATCH", 
        endpoint: `/${apiPrefix}/publish-quest?id=${id}`,
        data: { id, questId: id, status: "Ended" } 
      });
      toast({ title: "Quest closed", description: "The quest has been closed successfully." });
      fetchQuests();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setClosingId(null);
    }
  };

  const confirmAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "delete") {
      handleDelete(pendingAction.id);
      return;
    }
    if (pendingAction.type === "close") {
      handleClose(pendingAction.id);
      return;
    }
  };

  const renderQuestCard = (quest: Quest) => {
    const draft = isDraft(quest);
    const scheduled = isScheduled(quest);
    const completed = isCompleted(quest);

    let status = "Published";
    let statusColor = "bg-green-500";

    if (draft) {
      status = "Draft";
      statusColor = "bg-yellow-500";
    } else if (scheduled) {
      status = "Upcoming";
      statusColor = "bg-blue-500";
    } else if (completed) {
      status = "Closed";
      statusColor = "bg-gray-500";
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    };

    const createUrl = "/user-dashboard/create-new-quest";

    return (
      <Card key={quest._id} className="w-full h-full bg-white text-[#1c2533] rounded-xl overflow-hidden shadow-lg flex flex-col">
        {quest.projectCoverImage ? (
          <img src={quest.projectCoverImage} alt={quest.title || quest.description} className="w-full h-28 object-cover" />
        ) : (
          <div className="w-full h-28 bg-[#efeafb] flex items-center justify-center">
            <span className="text-[#69728a] text-xs">No Image</span>
          </div>
        )}

        <div className="p-3 flex flex-1 flex-col gap-1.5 text-left">
          <h3 className="font-bold text-sm truncate" title={quest.title || quest.description}>
            {quest.title || quest.description}
          </h3>
          <p className="text-[#3d485c] text-xs">
            {formatDate(quest.starts_at)} - {formatDate(quest.ends_at)}
          </p>
          {Number(quest.reward?.pool ?? 0) > 0 && (
            <p className="text-[#8a3ffc] text-xs font-medium">Reward Pool: {quest.reward?.pool} TRUST</p>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-3">
            <div className="flex gap-1.5 flex-wrap">
              <button
                className="flex-1 px-2 py-1.5 text-xs bg-[#8B3EFE] rounded-lg hover:bg-[#7b35e6] transition"
                onClick={() => router.push(`${createUrl}?edit=${quest._id}`)}
              >
                View Details
              </button>

              {!draft && !completed && (
                <button
                  title="Close quest"
                  className="px-2 py-1.5 text-xs bg-yellow-600/20 text-[#c27c00] rounded-lg hover:bg-yellow-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setPendingAction({ type: "close", id: quest._id, title: quest.title || quest.description || "Untitled" })}
                  disabled={closingId === quest._id || deletingId === quest._id}
                >
                  {closingId === quest._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                </button>
              )}

              {(draft || completed) && (
                <button
                  title="Delete quest"
                  className="px-2 py-1.5 text-xs bg-red-600/20 text-[#e4545b] rounded-lg hover:bg-red-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => setPendingAction({ type: "delete", id: quest._id, title: quest.title || quest.description || "Untitled" })}
                  disabled={deletingId === quest._id || closingId === quest._id}
                >
                  {deletingId === quest._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>

            {scheduled ? (
              <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded self-start bg-white border border-purple-500/30">
                <Clock className="w-3 h-3 text-[#8a3ffc] animate-pulse" />
                <span className="text-[#8a3ffc] font-mono font-semibold">{countdowns[quest._id] || "Loading..."}</span>
              </div>
            ) : (
              <span className={`px-2 py-0.5 text-[10px] rounded self-start ${statusColor}`}>{status}</span>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const createUrl = "/user-dashboard/create-new-quest";

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1c2533] text-left">Quests</h1>
            <p className="text-[#69728a] text-lg text-left">Manage and track your community quests</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-[#69728a] hover:text-[#1c2533]"
            onClick={() => fetchQuests()}
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex border-b border-[rgba(28,37,51,0.12)] gap-4 pb-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? "border-b-2 border-purple-500 text-[#1c2533]" : "text-[#69728a] hover:text-[#1c2533]"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {isUser && <CreatorRewardsBanner />}

        {loading ? (
          <StudioLoader message="Loading quests…" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {activeTab === "all" && (
              <Link
                href={createUrl}
                className="w-full p-6 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-purple-500 rounded-2xl bg-white hover:bg-[#f4f1fc] hover:border-[#8B3EFE] transition cursor-pointer no-underline"
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-full bg-purple-500/20 text-[#8a3ffc] text-2xl font-bold">+</div>
                <p className="font-semibold text-[#1c2533] text-center text-lg">Create New Quest</p>
                <p className="text-[#69728a] text-center text-sm">Launch a New Quest now</p>
              </Link>
            )}

            {filteredQuests.length === 0 ? (
              <p className="text-[#69728a] col-span-full">No quests found.</p>
            ) : (
              filteredQuests.map((q) => renderQuestCard(q))
            )}
          </div>
        )}
      </div>

      <Dialog open={!!pendingAction} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <DialogContent className="bg-white border border-[rgba(28,37,51,0.12)] text-[#1c2533] rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle
              className={
                pendingAction?.type === "delete"
                  ? "text-[#e4545b]"
                  : "text-[#c27c00]"
              }
            >
              {pendingAction?.type === "delete" ? "Delete Quest" : "Close Quest"}
            </DialogTitle>
            <DialogDescription className="text-[#69728a] pt-1">
              {pendingAction?.type === "delete"
                ? (<>This will <span className="text-[#e4545b] font-semibold">permanently delete</span> <span className="text-[#1c2533] font-medium">"{pendingAction?.title}"</span>. This action cannot be undone.</>)
                : (<>This will close <span className="text-[#1c2533] font-medium">\"{pendingAction?.title}\"</span>. It will no longer accept submissions.</>)
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="ghost" className="text-[#69728a] hover:text-[#1c2533]" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              className={
                pendingAction?.type === "delete"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-yellow-600 hover:bg-yellow-700 text-white"
              }
              onClick={confirmAction}
            >
              {pendingAction?.type === "delete" ? "Delete" : "Close Quest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
