"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { projectApiRequest } from "@/lib/projectApi";
import { userApiRequest } from "@/lib/userApi";
import { payStudioHubFee } from "@/lib/performOnchainAction";
import { getQuestFeeContract } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { getStoredUserSession } from "@/lib/userSession";
import { apiRequestV2 } from "@/lib/queryClient";
import {
  Calendar,
  ImageIcon,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
  Loader2,
  Clock,
} from "lucide-react";

type Task = {
  _id: string | undefined;
  type: string;
  platform: string;
  handleOrUrl: string;
  description: string;
  evidence: string;
  validation: string;
  verificationMode: string;
};

interface QuestCreateProps {
  isUserMode?: boolean;
}

export default function QuestCreate({ isUserMode = false }: QuestCreateProps) {
  const router = useRouter();
  const { toast } = useToast();
  const session = getStoredUserSession();
  const apiPrefix = isUserMode ? "user-hub" : (session?.type === "user" ? "user-hub" : "hub");
  const apiRequest = isUserMode ? userApiRequest : (session?.type === "user" ? userApiRequest : projectApiRequest);

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [questId, setQuestId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "details";
    return localStorage.getItem("questBuilderActiveTab") || "details";
  });

  useEffect(() => {
    localStorage.setItem("questBuilderActiveTab", activeTab);
  }, [activeTab]);
  const [showModal, setShowModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentTxHash, setPaymentTxHash] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState<Task>({
    _id: undefined,
    type: "",
    platform: "",
    handleOrUrl: "",
    description: "",
    evidence: "",
    validation: "Manual Validation",
    verificationMode: "",
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [urlError, setUrlError] = useState("");

  const [questName, setQuestName] = useState("");
  const [questDescription, setQuestDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [coverError, setCoverError] = useState("");
  const [publishedQuest, setPublishedQuest] = useState<any>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const XP_REWARDS = "200";

  useEffect(() => {
    const editId = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("edit");
    if (!editId) return;

    (async () => {
      try {
        const res = await apiRequest<{ quests?: any[]; hubQuests?: any[] }>({
          method: "GET",
          endpoint: `/${apiPrefix}/get-quests`,
        });
        const allQuests = res.quests ?? res.hubQuests ?? [];
        const found = allQuests.find((q: any) => q._id === editId);
        if (!found) return;

        setQuestId(editId);
        setIsEditMode(true);
        setIsPublished(found.status !== "Save");
        setQuestName(found.title ?? "");
        setQuestDescription(found.description ?? "");
        
        if (found.starts_at) {
          const s = new Date(found.starts_at);
          setStartDate(s.toISOString().split('T')[0]);
          setStartTime(s.toISOString().split('T')[1].slice(0, 5));
        }
        if (found.ends_at) {
          const e = new Date(found.ends_at);
          setEndDate(e.toISOString().split('T')[0]);
          setEndTime(e.toISOString().split('T')[1].slice(0, 5));
        }
        
        if (found.projectCoverImage) setCoverImagePreview(found.projectCoverImage);

        // Load mini quests (tasks)
        const miniData = await apiRequestV2("GET", `/api/quest/fetch-mini-quests?id=${editId}`);
        setTasks((miniData.miniQuests || []).map((q: any) => ({
          _id: q._id,
          type: tagToType(q.tag),
          platform: q.category === "twitter" ? "Twitter" : (q.category === "discord" ? "Discord" : "Other"),
          handleOrUrl: q.link ?? "",
          description: q.text || q.quest || "",
          validation: q.verificationMode === "auto" ? "Auto Verified" : (q.category === "discord" ? "Discord Auth" : "Manual Validation"),
          verificationMode: q.verificationMode ?? "",
        })));
      } catch (err) {
        console.error("Failed to load quest", err);
      }
    })();
  }, [apiPrefix]);

  const handleCoverImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImage(file);
    setCoverError("");
    const reader = new FileReader();
    reader.onload = () => setCoverImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const toIsoDateTime = (date: string, time: string) => {
    if (!date) return "";
    return `${date}T${time || "00:00"}:00.000Z`;
  };

  const tagToType = (tag: string) => {
    if (tag === "comment-x") return "Comment on X";
    if (tag === "follow-x") return "Follow on X";
    if (tag === "portal") return "Portal Claims";
    if (tag === "i-trust") return "I Trust (Portal Claim)";
    if (tag === "i-collaborated") return "I Collaborated (Portal Claim)";
    if (tag === "i-interact") return "I Interacted (Portal Claim)";
    if (tag === "i-follow") return "I Follow (Portal Claim)";
    if (tag === "feedback") return "Give Feedback";
    if (tag === "trust-name") return "Own a .trust username";
    if (tag === "create-post") return "Create a Post";
    if (tag === "repost-x") return "Retweet on X";
    if (tag === "telegram") return "Join Telegram Channel";
    if (tag === "join-discord") return "Join Discord Server";
    if (tag === "acquire-role-discord") return "Acquire a Discord Role";
    if (tag === "send-message-discord" || tag === "message-discord" || tag === "message") return "Send a Discord Message";
    if (tag === "hold-token") return "Hold an ERC20 Token";
    if (tag === "hold-nft") return "Hold an NFT";
    if (tag === "submit-wallet") return "Submit Wallet Address";
    if (tag === "watch-youtube") return "Watch YouTube Video";
    if (tag === "visit-website") return "Visit a Link";
    return "Other";
  };

  const typeToTag = (type: string) => {
    if (type === "Comment on X") return "comment-x";
    if (type === "Follow on X") return "follow-x";
    if (type === "Portal Claims") return "portal";
    if (type === "I Trust (Portal Claim)") return "i-trust";
    if (type === "I Collaborated (Portal Claim)") return "i-collaborated";
    if (type === "I Interacted (Portal Claim)") return "i-interact";
    if (type === "I Follow (Portal Claim)") return "i-follow";
    if (type === "Give Feedback") return "feedback";
    if (type === "Create a Post") return "create-post";
    if (type === "Own a .trust username") return "trust-name";
    if (type === "Retweet on X") return "repost-x";
    if (type === "Join Telegram Channel") return "telegram";
    if (type === "Join Discord Server") return "join-discord";
    if (type === "Acquire a Discord Role") return "acquire-role-discord";
    if (type === "Send a Discord Message") return "send-message-discord";
    if (type === "Hold an ERC20 Token") return "hold-token";
    if (type === "Hold an NFT") return "hold-nft";
    if (type === "Submit Wallet Address") return "submit-wallet";
    if (type === "Watch YouTube Video") return "watch-youtube";
    if (type === "Visit a Link") return "visit-website";
    return "other";
  };

  const isIntuitionType = (type: string) =>
    type === "I Trust (Portal Claim)" ||
    type === "I Collaborated (Portal Claim)" ||
    type === "I Interacted (Portal Claim)" ||
    type === "I Follow (Portal Claim)";

  const buildQuestFormData = (isDraft: boolean): FormData => {
    const fd = new FormData();
    fd.append("title", questName);
    fd.append("description", questDescription);
    fd.append("starts_at", toIsoDateTime(startDate, startTime));
    fd.append("ends_at", toIsoDateTime(endDate, endTime));
    fd.append("xp", XP_REWARDS);
    fd.append("page", session?.type === "user" ? "user" : "project");
    if (coverImage) fd.append("coverImage", coverImage);
    if (isDraft) fd.append("status", "Save");
    else fd.append("status", "Active");

    const miniQuests = tasks.map(t => {
      const isCreatePost = t.type === "Create a Post";
      const isTrustName = t.type === "Own a .trust username";
      const isIntuition = isIntuitionType(t.type);
      return {
        _id: t._id,
        quest: t.description || t.type,
        link: isCreatePost ? "https://x.com" : (isTrustName ? "https://tns.intuition.box" : isIntuition ? "https://atlas.box" : (t.handleOrUrl || "https://x.com")),
        tag: typeToTag(t.type),
        category: isCreatePost ? "twitter" : (t.platform || "Other").toLowerCase(),
        verificationMode: t.verificationMode || "",
      };
    });
    fd.append("miniQuests", JSON.stringify(miniQuests));

    return fd;
  };

  const handleSaveDraft = async (thenNavigate?: string) => {
    console.log("[ACTION] QuestCreate.handleSaveDraft — save draft");
    if (!questName) {
      toast({ title: "Missing Name", description: "Please enter a quest name.", variant: "destructive" });
      return null;
    }

    if (!coverImage && !coverImagePreview) {
      setCoverError("Add a cover image to continue.");
      toast({ title: "Cover Image Required", description: "Add a cover image to continue.", variant: "destructive" });
      return null;
    }

    if (questDescription.length > 0 && (questDescription.length < 50 || questDescription.length > 100)) {
      toast({ title: "Invalid Description", description: "Quest description must be between 50 and 100 characters.", variant: "destructive" });
      return null;
    }

    if (thenNavigate === "review" && tasks.length < 5) {
      toast({ title: "Incomplete", description: "Please add at least 5 tasks before reviewing.", variant: "destructive" });
      return null;
    }

    setSaveLoading(true);
    try {
      const fd = buildQuestFormData(true);
      const endpoint = questId ? `/${apiPrefix}/save-quest` : `/${apiPrefix}/create-quest`;
      const res = await apiRequest<{ questId?: string }>({
        method: "POST",
        endpoint,
        formData: fd,
        params: questId ? { id: questId } : {},
      });
      if (res.questId) setQuestId(res.questId);
      toast({ title: "Draft Saved", description: "Your progress has been saved." });
      if (thenNavigate) setActiveTab(thenNavigate);
      return res.questId || questId;
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePublish = async () => {
    console.log("[ACTION] QuestCreate.handlePublish — publish quest");
    if (!questName || tasks.length < 5) {
      toast({ title: "Incomplete", description: "Please provide a name and at least 5 tasks.", variant: "destructive" });
      return;
    }

    if (questDescription.length < 50 || questDescription.length > 100) {
      toast({ title: "Invalid Description", description: "Quest description must be between 50 and 100 characters.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const savedId = questId ?? await handleSaveDraft();
      if (!savedId) return;

      const endpoint = `/${apiPrefix}/publish-quest`;
      await apiRequest({
        method: "PATCH",
        endpoint,
        params: { id: savedId },
        data: { txHash: paymentTxHash },
      });
      
      setPublishedQuest({
        title: questName,
        description: questDescription,
        coverImage: coverImagePreview
      });
      setShowPublishModal(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      toast({ title: "Publish Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuest = async () => {
    console.log("[ACTION] QuestCreate.handleUpdateQuest — update quest");
    if (!questId) return;

    if (questDescription.length < 50 || questDescription.length > 100) {
      toast({ title: "Invalid Description", description: "Quest description must be between 50 and 100 characters.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const fd = buildQuestFormData(false); // status: Active
      const endpoint = `/${apiPrefix}/save-quest`;
      await apiRequest({
        method: "POST",
        endpoint,
        formData: fd,
        params: { id: questId },
      });
      toast({ title: "Quest Updated", description: "Your changes have been saved." });
      router.push(session?.type === "user" ? "/user-dashboard/quests-tab" : "/studio-dashboard/campaigns-tab");
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTask = () => {
    console.log("[ACTION] QuestCreate.handleSaveTask — add/save task");
    const finalTask = { ...newTask };
    if (finalTask.type === "Create a Post") {
      finalTask.handleOrUrl = "https://x.com";
      finalTask.platform = "Twitter";
    }

    if (finalTask.type === "Own a .trust username") {
      finalTask.handleOrUrl = "https://tns.intuition.box";
      finalTask.platform = "";
    }

    if (!finalTask.type || (!isIntuitionType(finalTask.type) && !finalTask.handleOrUrl) || !finalTask.description) {
      return setError("All fields are required.");
    }

    const isTwitterTask = finalTask.type === "Comment on X" || finalTask.type === "Follow on X" || finalTask.type === "Retweet on X";
    
    // Enforce x.com for Twitter tasks
    if (isTwitterTask) {
      const url = finalTask.handleOrUrl.toLowerCase();
      if (!url.includes("x.com")) {
        return setError("Twitter links must use the x.com domain.");
      }
    }

    // Enforce Portal prefixes for Portal Claims tasks
    if (finalTask.type === "Portal Claims") {
      const url = finalTask.handleOrUrl.toLowerCase();
      const allowedPrefixes = [
        "nexura.intuition.box/portal-claims/",
        "portal.intuition.systems/explore/triple/"
      ];
      const isAllowed = allowedPrefixes.some(prefix => url.includes(prefix));
      if (!isAllowed) {
        return setError("Portal Claims must be from Nexura Portal or Intuition Portal triple.");
      }
    }

    if (editingIndex !== null) {
      const updated = [...tasks];
      updated[editingIndex] = finalTask;
      setTasks(updated);
      setEditingIndex(null);
    } else {
      setTasks([...tasks, finalTask]);
    }

    setShowModal(false);
    setNewTask({
      _id: undefined,
      type: "",
      platform: "",
      handleOrUrl: "",
      description: "",
      evidence: "",
      validation: "Manual Validation",
      verificationMode: "",
    });
    setError("");
    setUrlError("");
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB");
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-8 pb-24 md:pb-8 text-[#1c2533]">
      <div className="max-w-5xl mx-auto space-y-8 text-left">
        <div>
          <h1 className="text-3xl font-bold">{questId ? "Edit Quest" : "Create New Quest"}</h1>
          <p className="text-[#69728a] mt-2">
            Set up your community quest and reward participants with XP.
          </p>
        </div>

        {/* Tabs - Mirrored from Campaign Builder */}
        <div className="flex gap-8 border-b border-[rgba(28,37,51,0.12)]">
          {[
            { id: "details", label: "Details", icon: "/details.png" },
            { id: "tasks", label: "Tasks", icon: "/tasks.png" },
            { id: "review", label: "Review", icon: "/review.png" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (tab.id === "review" && tasks.length < 5) {
                  toast({ title: "Incomplete", description: "Please add at least 5 tasks before reviewing.", variant: "destructive" });
                  return;
                }
                setActiveTab(tab.id);
              }}
              className="flex-1 flex flex-col items-start justify-start gap-2 py-5 text-lg font-semibold transition"
            >
              <span
                className={`block h-[4px] w-full rounded-full transition-colors ${
                  activeTab === tab.id ? "bg-[#8B3EFE]" : "bg-[#efeafb]"
                }`}
              />
              <div className="flex items-center gap-2 text-[#3d485c] hover:text-[#1c2533]">
                <img src={tab.icon} alt={tab.label} className="w-5 h-5" />
                <span className={activeTab === tab.id ? "text-[#8a3ffc]" : ""}>{tab.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* DETAILS TAB */}
        {activeTab === "details" && (
          <Card className="bg-purple/10 backdrop-blur-md p-8 space-y-8 border-[rgba(28,37,51,0.12)]">
            <div className="space-y-6">
              <div>
                <label className="block mb-2 text-sm font-medium text-[#1c2533]">Quest Name</label>
                <Input
                  placeholder="Enter quest name..."
                  className="bg-[#f4f1fc] border-[rgba(28,37,51,0.12)] text-[#1c2533] rounded-xl"
                  value={questName}
                  onChange={(e) => setQuestName(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-[#1c2533]">Quest Description</label>
                  <span className={`text-[10px] ${questDescription.length < 50 || questDescription.length > 100 ? "text-[#e4545b]" : "text-[#69728a]"}`}>
                    {questDescription.length}/100
                  </span>
                </div>
                <textarea
                  placeholder="Explain what learners will get out of this quest... (50-100 characters)"
                  className={`min-h-[80px] w-full rounded-xl border bg-[#f4f1fc] px-3 py-2 text-sm text-[#1c2533] placeholder:text-[#98a0b4] focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    questDescription.length > 0 && (questDescription.length < 50 || questDescription.length > 100)
                      ? "border-red-500/50"
                      : "border-[rgba(28,37,51,0.12)]"
                  }`}
                  value={questDescription}
                  maxLength={100}
                  onChange={(e) => setQuestDescription(e.target.value)}
                />
                {questDescription.length > 0 && questDescription.length < 50 && (
                  <p className="text-[10px] text-[#e4545b] mt-1">
                    Minimum 50 characters required. {50 - questDescription.length} more needed.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-sm mb-2 font-medium text-[#1c2533]">
                    <Calendar className="w-4 h-4" /> Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-md bg-[#f4f1fc] border border-[rgba(28,37,51,0.12)] text-[#1c2533] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark]"
                    value={startDate && startTime ? `${startDate}T${startTime}` : ""}
                    onChange={(e) => {
                      const [d, t] = e.target.value.split("T");
                      setStartDate(d || "");
                      setStartTime(t ? t.slice(0, 5) : "");
                    }}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm mb-2 font-medium text-[#1c2533]">
                    <Calendar className="w-4 h-4" /> End Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-md bg-[#f4f1fc] border border-[rgba(28,37,51,0.12)] text-[#1c2533] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark]"
                    value={endDate && endTime ? `${endDate}T${endTime}` : ""}
                    onChange={(e) => {
                      const [d, t] = e.target.value.split("T");
                      setEndDate(d || "");
                      setEndTime(t ? t.slice(0, 5) : "");
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm mb-3 font-medium text-[#1c2533]">
                  <ImageIcon className="w-4 h-4" /> Cover Image
                </label>
                <label className="w-full border-2 border-dashed border-purple-500 rounded-2xl p-8 bg-white hover:border-[#8B3EFE] cursor-pointer transition block text-center">
                  <input type="file" accept="image/*" onChange={handleCoverImage} className="hidden" />
                  {coverImagePreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <img src={coverImagePreview} alt="Preview" className="h-32 w-full object-cover rounded-xl" />
                      <p className="text-sm text-[#69728a]">Click to change image</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center gap-2">
                      <img src="/upload-icon.png" alt="Upload" className="w-16 h-16" />
                      <p className="font-medium text-[#1c2533]">Click to upload or drag and drop</p>
                      <p className="text-sm text-[#69728a]">SVG, PNG, JPG or GIF (max. 10MB)</p>
                    </div>
                  )}
                </label>
                {coverError && (
                  <p className="text-[11px] text-[#e4545b] mt-2 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {coverError}
                  </p>
                )}
              </div>

              <div className="flex justify-between pt-4">
                <Button type="button" variant="ghost" className="text-[#69728a] hover:text-[#1c2533]" onClick={() => router.push(session?.type === "user" ? "/user-dashboard" : "/studio-dashboard")}>← Back</Button>
                <Button type="button" className="bg-[#8B3EFE] hover:bg-[#7b35e6] text-white" onClick={() => handleSaveDraft("tasks")}>Next →</Button>
              </div>
            </div>
          </Card>
        )}

        {/* TASKS TAB - Exact match to Campaign Builder */}
        {activeTab === "tasks" && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setEditingIndex(null);
                setNewTask({ _id: undefined, type: "", platform: "", handleOrUrl: "", description: "", evidence: "", validation: "Manual Validation", verificationMode: "" });
                setShowModal(true);
              }}
              className="absolute -top-10 right-0 px-3 py-1 bg-[#8B3EFE] text-[#8a3ffc] hover:bg-[#7b35e6] rounded-lg text-sm font-semibold flex items-center gap-2 transition"
            >
              <span className="flex items-center justify-center w-3 h-3 pb-1 bg-[#8B3EFE] text-purple-900 rounded-full text-xs font-bold">+</span>
              Add Task
            </button>

            {tasks.length === 0 ? (
              <div
                className="w-full border-2 border-dashed border-purple-500 rounded-2xl p-8 bg-white hover:border-[#8B3EFE] transition cursor-pointer mt-8"
                onClick={() => setShowModal(true)}
              >
                <div className="flex flex-col items-center justify-center text-center gap-2">
                  <img src="/upload-icon.png" alt="" className="w-16 h-16" />
                  <p className="font-medium text-[#1c2533]">Create a Quest Task</p>
                  <p className="text-sm text-[#69728a]">Add at least 5 tasks to continue.</p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="mt-4 flex items-center justify-center gap-2 px-4 py-1 bg-purple-900 text-[#8a3ffc] hover:bg-[#7b35e6] font-semibold rounded-lg transition"
                  >
                    <span className="flex items-center justify-center w-3 h-3 pb-1 bg-[#8B3EFE] text-purple-900 rounded-full text-lg font-bold">+</span>
                    Add Task
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mt-8">
                {tasks.map((task, index) => (
                  <div key={index} className="flex items-center justify-between gap-4 rounded-lg border-2 border-purple-500 px-4 py-3 bg-[#f4f1fc]">
                    <div className="flex items-center justify-center w-8 h-8 bg-[#efeafb] rounded-full text-[#1c2533] font-semibold">{index + 1}</div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[#1c2533] text-sm font-medium">{task.description || task.type}</p>
                      <p className="text-xs text-[#69728a] truncate">
                        {task.platform} · {task.validation}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1 bg-[#efeafb] text-[#1c2533] rounded-lg text-sm hover:bg-[#e6dffa] transition"
                        onClick={() => {
                          setNewTask(task);
                          setEditingIndex(index);
                          setShowModal(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="px-3 py-1 bg-white rounded-lg text-[#1c2533] hover:bg-[#e6dffa] transition"
                        onClick={() => setTasks(tasks.filter((_, i) => i !== index))}
                      >
                        <img src="/delete.png" alt="Delete" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-6">
              <button className="px-4 py-2 bg-[#efeafb] text-[#1c2533] rounded-lg text-sm hover:bg-[#e6dffa] transition font-medium" onClick={() => setActiveTab("details")}>← Back</button>
              <button
                className="px-6 py-2 bg-[#8B3EFE] text-white rounded-lg text-sm font-semibold hover:bg-[#7b35e6] transition flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={saveLoading || tasks.length < 5}
                onClick={() => {
                  if (tasks.length < 5) {
                    toast({ title: "Incomplete", description: "Please add at least 5 tasks before reviewing.", variant: "destructive" });
                    return;
                  }
                  handleSaveDraft("review");
                }}
              >
                {saveLoading ? "Saving..." : "Next →"}
                {!saveLoading && <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
              </button>
            </div>
          </div>
        )}

        {/* REVIEW TAB - Exact match to Campaign Builder */}
        {activeTab === "review" && (
          <Card className="p-8 space-y-6 bg-white border-[rgba(28,37,51,0.12)] text-[#1c2533]">
            <h2 className="text-2xl font-bold">Final Quest Review</h2>
            <div className="rounded-xl border border-purple-500/60 bg-[#f4f1fc] overflow-hidden">
              <div className="flex gap-6 p-6 text-left">
                <div className="w-36 h-36 flex-shrink-0 rounded-xl overflow-hidden border border-[rgba(28,37,51,0.12)]">
                  {coverImagePreview ? (
                    <img src={coverImagePreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#f4f1fc] text-[#69728a] text-sm font-medium">No Image</div>
                  )}
                </div>
                <div className="flex flex-col justify-center gap-1 min-w-0">
                  <h3 className="text-xl font-bold text-[#1c2533] truncate">{questName || "Untitled Quest"}</h3>
                  <p className="text-[#69728a] text-sm">{questDescription || "No description provided"}</p>
                  {startDate && endDate && (
                    <p className="text-[#69728a] text-xs mt-1">{formatDate(startDate)} {startTime} → {formatDate(endDate)} {endTime}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-[rgba(28,37,51,0.12)]" />

              <div className="grid grid-cols-2 md:grid-cols-3 divide-y md:divide-y-0 divide-x-0 md:divide-x divide-[rgba(28,37,51,0.09)] text-left">
                <div className="flex flex-col gap-1 p-5">
                  <div className="flex items-center gap-2 text-[#69728a] text-xs font-medium uppercase tracking-wide">
                    <span className="text-[#8a3ffc] font-bold text-sm leading-none">XP</span>
                    XP Reward
                  </div>
                  <span className="text-[#1c2533] text-lg font-semibold">{XP_REWARDS} XP</span>
                </div>
                <div className="flex flex-col gap-1 p-5 border-t md:border-t-0 border-l md:border-l border-[rgba(28,37,51,0.12)]">
                  <div className="flex items-center gap-2 text-[#69728a] text-xs font-medium uppercase tracking-wide">
                    <img src="/tasks.png" alt="" className="w-4 h-4 opacity-60" />
                    Tasks
                  </div>
                  <span className="text-[#1c2533] text-lg font-semibold">{tasks.length}</span>
                </div>
                <div className="flex flex-col gap-1 p-5 border-t border-[rgba(28,37,51,0.12)] md:border-l">
                  <div className="flex items-center gap-2 text-[#69728a] text-xs font-medium uppercase tracking-wide">
                    <Clock className="w-4 h-4 text-[#69728a]" />
                    Status
                  </div>
                  <span className={`text-lg font-semibold ${isPublished ? "text-[#00a87c]" : "text-[#1c2533]"}`}>
                    {isPublished ? "Live" : "Draft"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <h3 className="text-xl font-semibold">Task Overview</h3>
              <button type="button" className="px-3 py-1 bg-[#8B3EFE] text-white rounded-lg text-sm hover:bg-[#7b35e6] transition font-medium" onClick={() => setActiveTab("tasks")}>Manage Tasks</button>
            </div>

            {tasks.length > 0 && (
              <div className="relative mt-2 space-y-4">
                {tasks.map((task, index) => (
                  <div key={index} className="flex items-center justify-between gap-4 rounded-lg border-2 border-purple-500 px-4 py-3 bg-[#f4f1fc] text-left">
                    <div className="flex items-center justify-center w-8 h-8 bg-[#efeafb] rounded-full text-[#1c2533] font-semibold">{index + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#1c2533] text-sm font-medium">{task.description || task.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" className="px-3 py-1 bg-[#8B3EFE] text-white rounded-lg text-sm hover:bg-[#7b35e6] transition font-medium" onClick={() => window.open(task.handleOrUrl, "_blank")}>View</button>
                      <button type="button" className="px-3 py-1 bg-[#efeafb] text-[#1c2533] rounded-lg text-sm hover:bg-[#e6dffa] transition font-medium" onClick={() => { setEditingIndex(index); setNewTask(task); setShowModal(true); setActiveTab("tasks"); }}>Edit</button>
                      <button type="button" className="px-3 py-1 bg-white rounded-lg text-white hover:bg-red-800 transition" onClick={() => setTasks(tasks.filter((_, i) => i !== index))}>
                        <img src="/delete.png" alt="Delete" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <span className="absolute -bottom-8 right-2 text-[#69728a] text-sm mt-2">{tasks.length}/{tasks.length}</span>
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              <button type="button" className="px-4 py-2 bg-[#efeafb] text-[#1c2533] rounded-lg text-sm hover:bg-[#e6dffa] transition font-medium" onClick={() => setActiveTab("tasks")}>Back</button>
              {isEditMode && isPublished ? (
                <button
                  type="button"
                  className="px-6 py-2 bg-[#8B3EFE] text-white rounded-lg text-sm font-semibold hover:bg-[#7b35e6] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                  onClick={handleUpdateQuest}
                >
                  {loading ? "Updating..." : "Update Quest"}
                </button>
              ) : (
                <button
                  type="button"
                  className="px-6 py-2 bg-[#8B3EFE] text-white rounded-lg text-sm font-semibold hover:bg-[#7b35e6] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                  onClick={() => setShowPublishModal(true)}
                >
                  {loading ? "Publishing..." : "Publish Quest"}
                </button>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Task Modal - Cleaned up to original quest types */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm p-4 text-left">
          <div className="bg-white w-full max-w-xl border border-purple-500/20 p-6 rounded-2xl relative shadow-[0_0_60px_rgba(131,58,253,0.2)] animate-modal-pop">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#f4f1fc] hover:bg-[rgba(138,63,252,0.06)] text-[#69728a] hover:text-[#1c2533] transition-all text-lg leading-none">&times;</button>
            <h2 className="text-xl font-semibold text-[#1c2533] mb-6">
              Add New Task
            </h2>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="text-sm text-[#3d485c] mb-2 block">Task Type</label>
                <select
                  className="w-full p-2 rounded-lg bg-white text-[#1c2533] border border-[rgba(28,37,51,0.12)] focus:outline-none focus:border-purple-500 [&>option]:bg-white"
                  value={newTask.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    const isTwitter = type === "Comment on X" || type === "Follow on X" || type === "Create a Post";
                    const isPortal = type === "Portal Claims";
                    const isFeedback = type === "Give Feedback";
                    const isTrustName = type === "Own a .trust username";
                    const isIntuition = isIntuitionType(type);
                    const validationLabel =
                      isTrustName ? "Verified by TNS" :
                      (isPortal || isIntuition) ? "Auto Verified" :
                      "Manual Validation";
                    setNewTask({
                      ...newTask,
                      type,
                      platform: isTwitter ? "Twitter" : (isPortal || isFeedback || isTrustName || isIntuition) ? "" : newTask.platform || "Other",
                      validation: validationLabel,
                      verificationMode: (isPortal || isIntuition) ? "auto" : isFeedback ? "feedback" : isTrustName ? "auto" : "",
                      handleOrUrl: type === "Create a Post" ? "https://x.com" : (isTrustName ? "https://tns.intuition.box" : isIntuition ? "" : (newTask.handleOrUrl === "https://x.com" || newTask.handleOrUrl === "https://tns.intuition.box" ? "" : newTask.handleOrUrl)),
                    });
                  }}
                >
                  <option value="">Select task</option>
                  <option value="Comment on X">Comment on X</option>
                  <option value="Follow on X">Follow on X</option>
                  <option value="Create a Post">Create a Post</option>
                  <option value="Own a .trust username">Own a .trust username</option>
                  <option value="Portal Claims">Portal Claims</option>
                  <option value="Give Feedback">Give Feedback</option>
                  <option value="I Trust (Portal Claim)">I Trust (Portal Claim)</option>
                  <option value="I Collaborated (Portal Claim)">I Collaborated (Portal Claim)</option>
                  <option value="I Interacted (Portal Claim)">I Interacted (Portal Claim)</option>
                  <option value="I Follow (Portal Claim)">I Follow (Portal Claim)</option>
                </select>
              </div>

              {/* Platform - Matches Campaign UI but restricted for Quest modal */}
              {newTask.type !== "Portal Claims" && newTask.type !== "Give Feedback" && newTask.type !== "Own a .trust username" && !isIntuitionType(newTask.type) && (
                <div>
                  <label className="text-sm text-[#3d485c] mb-2 block">Platform</label>
                  <div className="flex gap-3">
                    <div
                      className="flex-1 border py-2 rounded-lg transition text-xs font-semibold text-center bg-[#8B3EFE] text-white border-purple-500 opacity-90 cursor-default"
                    >
                      Twitter
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#f4f1fc] p-5 rounded-xl mb-6 border border-[rgba(28,37,51,0.12)]">
              <div className="mb-4">
                <label className="text-sm text-[#3d485c] mb-2 block">
                  {newTask.type === "Create a Post" ? "Post Content" : "Task Description"}
                </label>
                <input
                  type="text"
                  placeholder={
                    newTask.type === "Create a Post" ? "e.g. Just joined this amazing quest on Nexura!" :
                    newTask.type === "Comment on X" ? "e.g. Reply to our latest announcement" :
                    newTask.type === "Follow on X" ? "e.g. Follow @NexuraApp for updates" :
                    newTask.type === "Own a .trust username" ? "e.g. Acquire your unique identity on TNS" :
                    newTask.type === "Portal Claims" ? "Support or oppose this claim" :
                    newTask.type === "Give Feedback" ? "e.g. Tell us about your experience" :
                    "e.g. Complete this task to earn rewards"
                  }
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  className="w-full p-2 rounded-lg bg-[#f4f1fc] text-[#1c2533] border border-[rgba(28,37,51,0.12)] focus:outline-none focus:border-purple-500"
                />
              </div>
              {newTask.type !== "Create a Post" && newTask.type !== "Own a .trust username" && !isIntuitionType(newTask.type) && (
                <div className="mb-4">
                  <label className="text-sm text-[#3d485c] mb-2 block">
                    Handle or URL
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://..."
                    value={newTask.handleOrUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTask({...newTask, handleOrUrl: val});
                      
                      const valLower = val.toLowerCase().trim();
                      if (!valLower) {
                        setUrlError("");
                        return;
                      }

                      // Immediate feedback for x.com enforcement
                      if (newTask.platform === "Twitter" && newTask.type !== "Create a Post") {
                        if (!valLower.includes("x.com")) {
                          setUrlError("Twitter links must use the x.com domain.");
                        } else {
                          setUrlError("");
                        }
                      } 
                      // Immediate feedback for Portal Claims enforcement
                      else if (newTask.type === "Portal Claims") {
                        const allowedPrefixes = [
                          "nexura.intuition.box/portal-claims/",
                          "portal.intuition.systems/explore/triple/"
                        ];
                        const isAllowed = allowedPrefixes.some(prefix => valLower.includes(prefix));
                        if (!isAllowed) {
                          setUrlError("URL must be from Nexura Portal or Intuition Portal triple.");
                        } else {
                          setUrlError("");
                        }
                      }
                      else {
                        setUrlError("");
                      }
                    }}
                    className={`w-full p-2 rounded-lg bg-[#f4f1fc] text-[#1c2533] border focus:outline-none focus:border-purple-500 transition-colors ${urlError ? "border-red-500/50" : "border-[rgba(28,37,51,0.12)]"}`}
                  />
                  {urlError && <p className="text-red-500 text-[11px] mt-1.5 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {urlError}
                  </p>}
                </div>
              )}
            </div>

            {/* Validation & Evidence - Matches Campaign UI for standard tasks */}
            {newTask.validation && (newTask.type === "Portal Claims" || newTask.type === "Give Feedback" || newTask.type === "Own a .trust username" || isIntuitionType(newTask.type)) ? (
              <div className={`mb-6 flex items-center gap-3 rounded-lg px-4 py-3 border ${newTask.type === "Give Feedback" ? "bg-emerald-900/50 border-emerald-500/50" : "bg-purple-900/50 border-purple-500/50"}`}>
                {newTask.type === "Give Feedback" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#00a87c] flex-shrink-0">
                    <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.29 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.68-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#8a3ffc] flex-shrink-0">
                    <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                  </svg>
                )}
                <div>
                  <p className={`text-sm font-medium ${newTask.type === "Give Feedback" ? "text-[#00a87c]" : "text-[#8a3ffc]"}`}>
                    {newTask.type === "Own a .trust username" ? "Verified by TNS" : newTask.type === "Portal Claims" ? "Auto-verified via Portal" : isIntuitionType(newTask.type) ? "Auto-verified via Intuition" : newTask.validation}
                  </p>
                  <p className="text-xs text-[#69728a] mt-0.5">
                    {newTask.type === "Give Feedback"
                      ? "Users will visit the website and submit written feedback (min. 200 characters). Reviewed manually."
                      : newTask.type === "Own a .trust username"
                        ? "Completion is verified automatically by checking the user's TNS records."
                        : isIntuitionType(newTask.type)
                          ? "The user visits the view link, performs the on-chain claim, then returns and completion is verified automatically."
                          : "Completion is verified automatically after the user completes the task."}
                  </p>
                </div>
              </div>
            ) : newTask.validation && (
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Evidence Upload */}
                <div>
                  <label className="text-sm text-[#3d485c] mb-2 block">Evidence Upload</label>
                  <div className="flex items-center gap-2 w-full p-2 rounded-lg bg-[#f4f1fc] border border-[rgba(28,37,51,0.12)] text-[#1c2533] text-sm">
                    <span className="text-[#8a3ffc]">🔗</span>
                    <span>Submit Link</span>
                  </div>
                </div>

                {/* Validation Type */}
                <div>
                  <label className="text-sm text-[#3d485c] mb-2 block">Validation Type</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newTask.validation}
                      readOnly
                      className="w-full p-2 rounded-lg bg-[#f4f1fc] text-[#1c2533] border border-[rgba(28,37,51,0.12)] focus:outline-none focus:border-purple-500 pr-10"
                    />
                    <img
                      src="/purple-check.png"
                      alt="Verified"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 flex items-center gap-2 text-[#e4545b] bg-red-400/10 border border-red-400/20 p-3 rounded-xl text-xs">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl bg-[#f4f1fc] hover:bg-[rgba(138,63,252,0.06)] border border-[rgba(28,37,51,0.12)] text-[#3d485c] hover:text-[#1c2533] text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTask}
                className="px-5 py-2.5 rounded-xl bg-[#8B3EFE] text-white text-sm font-semibold hover:opacity-90 hover:shadow-[0_0_20px_rgba(131,58,253,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                Save Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal - Mirrored from Campaign Builder */}
      {showPublishModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm p-4 text-left">
          <div className="bg-white w-full max-w-sm border border-purple-500/20 p-5 rounded-2xl relative shadow-[0_0_60px_rgba(131,58,253,0.2)] animate-modal-pop">
            <button onClick={() => setShowPublishModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#f4f1fc] hover:bg-[rgba(138,63,252,0.06)] text-[#69728a] hover:text-[#1c2533] transition-all text-lg leading-none">×</button>
            <div className="flex justify-center mb-2"><img src="/activate-studio.png" alt="" className="w-36 h-32" /></div>
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-[#1c2533]">Quest Launch Fee</h2>
              <p className="text-[#3d485c] mt-1 text-sm">Pay the quest launch fee to publish this quest and make it live for participants.</p>
            </div>
            <div className="bg-[#f4f1fc] border border-[rgba(28,37,51,0.12)] rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2"><span className="text-[#1c2533] font-semibold text-xs">Quest Launch Fee</span><span className="text-[#8a3ffc] font-bold text-xs">60 $TRUST</span></div>
              <p className="text-[#69728a] text-[10px] mb-3 leading-relaxed">A one-time fee of 60 $TRUST is required to launch and publish this quest.</p>
              {paymentTxHash ? (
                <div className="flex items-center gap-2 bg-green-900/40 border border-green-600/50 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-[#00a87c] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <div className="min-w-0">
                    <p className="text-[#00a87c] text-xs font-semibold">Payment confirmed</p>
                    <p className="text-[#69728a] text-[10px] truncate">{paymentTxHash}</p>
                  </div>
                </div>
              ) : (
                <button disabled={paymentLoading} onClick={async () => {
                  setPaymentLoading(true);
                  try {
                    const hash = await payStudioHubFee(undefined, getQuestFeeContract());
                    setPaymentTxHash(hash);
                    await apiRequest({ method: "PATCH", endpoint: `/${apiPrefix}/save-payment-hash`, data: { txHash: hash } });
                    toast({ title: "Payment successful", description: "60 $TRUST sent." });
                  } catch (err: any) {
                    toast({ title: "Payment failed", description: err?.message || "Insufficient funds.", variant: "destructive" });
                  } finally { setPaymentLoading(false); }
                }} className="w-full bg-[#8B3EFE] hover:bg-[#7b35e6] text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2">{paymentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pay 60 $TRUST"}</button>
              )}
            </div>
            <button className="w-full py-2.5 bg-[#8B3EFE] text-white rounded-xl font-semibold mb-2 disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90" onClick={handlePublish} disabled={!paymentTxHash || loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}</button>
            <button onClick={() => setShowPublishModal(false)} className="w-full py-2.5 bg-[#f4f1fc] text-[#3d485c] rounded-xl font-medium border border-[rgba(28,37,51,0.12)] hover:bg-[rgba(138,63,252,0.06)] transition-all">Cancel</button>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm p-4 text-left">
          <div className="bg-white w-full max-w-lg border border-purple-500/20 p-5 rounded-2xl relative shadow-[0_0_60px_rgba(131,58,253,0.2)] animate-modal-pop">
            <button onClick={() => setShowSuccessModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-[#f4f1fc] hover:bg-[rgba(138,63,252,0.06)] text-[#69728a] hover:text-[#1c2533] transition-all text-lg leading-none">×</button>
            <div className="flex justify-center mb-4"><img src="/activate-studio.png" alt="" className="w-36 h-28" /></div>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-[#1c2533]">Quest Successfully Published</h2>
              <p className="text-[#3d485c] mt-2 text-sm">Your 60 $TRUST payment was confirmed and your quest is now live.</p>
            </div>
            <div className="bg-[#f4f1fc] backdrop-blur-md rounded-xl border border-purple-500/30 p-4">
              <h3 className="text-[10px] font-semibold text-[#69728a] mb-3 uppercase tracking-wider">Quest Snapshot</h3>
              <div className="flex gap-4">
                <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-[rgba(28,37,51,0.12)]">
                  <img src={publishedQuest?.coverImage || "/quest-1.png"} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[#1c2533] leading-tight">{publishedQuest?.title}</h3>
                    <p className="text-[#69728a] text-xs mt-1 line-clamp-2 leading-relaxed">{publishedQuest?.description}</p>
                  </div>
                  <div className="flex mt-3 text-[#3d485c] border border-[rgba(28,37,51,0.12)] rounded-lg overflow-hidden">
                    <div className="flex-1 flex flex-col items-center p-2 border-r border-[rgba(28,37,51,0.12)]">
                      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-50">Reward</span>
                      <span className="text-[#1c2533] mt-0.5 text-[11px] font-bold">{XP_REWARDS} XP</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center p-2">
                      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-50">Status</span>
                      <span className="mt-0.5 text-[11px] font-bold text-[#00a87c] uppercase">Live</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={() => router.push(session?.type === "user" ? "/user-dashboard/quests-tab" : "/studio-dashboard/campaigns-tab")} className="mt-6 w-full py-2.5 rounded-xl bg-[#8B3EFE] text-white text-sm font-semibold hover:opacity-90">Continue</Button>
          </div>
        </div>
      )}
    </main>
  );
}
