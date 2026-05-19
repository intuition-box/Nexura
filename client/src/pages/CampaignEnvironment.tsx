"use client";

import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { CheckCircle2, Play, ExternalLink, Globe, MessageCircle } from "lucide-react";
import AnimatedBackground from "../components/AnimatedBackground";
import { apiRequestV2, apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../lib/auth";
import { claimCampaignOnchainReward } from "../lib/performOnchainAction";
import { createProofOfAction } from "../services/web3";
import ProofOfActionModal from "../components/ProofOfActionModal";
import { environment } from "../lib/constants";

type Quest = {
  _id: string;
  quest: string;
  reward: number;
  tag: string;
  link: string;
  status: string;
  guildId?: string;
  roleId?: string;
  channelId?: string;
  metadata?: {
    guildId?: string;
    roleId?: string;
    channelId?: string;
  };
  hub?: string;
  done: boolean;
  feedbackCharLimit?: number;
};

// Minimum characters required for a feedback submission. Sourced from the
// admin-set `feedbackCharLimit` on the quest (admin-bounded to [10, 500]
// in the dashboard). Falls back to 10 only for legacy quests created
// before per-quest limits existed.
const FEEDBACK_MIN_FALLBACK = 10;

// Hard upper bound on what the textarea will accept regardless of admin
// settings — admin-set min is capped at 500, so 5000 leaves comfortable
// room above any sensible minimum.
const FEEDBACK_MAX_CHARS = 5000;

function resolveFeedbackMinChars(quest: Quest): number {
  const raw = (quest as { feedbackCharLimit?: unknown }).feedbackCharLimit;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : FEEDBACK_MIN_FALLBACK;
}

type HubInfo = {
  id?: string;
  name: string;
  description?: string;
  logo?: string;
  website?: string;
  xAccount?: string;
  discordServer?: string;
};

const campaignQuestsInitial: Quest[] = [
  { _id: "quest-id", status: " ", tag: "like", done: false, quest: "Follow Nexura on X", reward: 100, link: "https://x.com/NexuraXYZ" },
  { _id: "quest-id", status: " ", tag: "like", done: false, quest: "Join Nexura Discord", reward: 100, link: "https://discord.gg/caK9kATBya" },
  { _id: "quest-id", status: " ", tag: "like", done: false, quest: "Drop a message on Discord", reward: 100, link: "https://discord.gg/caK9kATBya" },
  { _id: "quest-id", status: " ", tag: "like", done: false, quest: "Support or Oppose the #Intuitionbilly Claim on Intuition Portal", reward: 100, link: "#" },
  { _id: "quest-id", status: " ", tag: "like", done: false, quest: "Support or oppose the Nexura claim on Intuition Portal", reward: 100, link: "#" },
  { _id: "quest-id", status: " ", tag: "like", done: false, quest: "Like and Comment on Nexura Pinned post", reward: 100, link: "#" },
];

export default function CampaignEnvironment() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const userId = user?._id || "";

  const { campaignId } = useParams();
  const { toast } = useToast();

  const [quests, setQuests] = useState<Quest[]>([]);
  const [visitedQuests, setVisitedQuests] = useState<string[]>(() => {
    const stored = JSON.parse(localStorage.getItem("nexura:campaign:visited") || "{}");
    return stored[userId] || [];
  });
  const [claimedQuests, setClaimedQuests] = useState<string[]>([]);
  const [retryQuests, setRetryQuests] = useState<string[]>([]);
  const [pendingQuests, setPendingQuests] = useState<string[]>([]);
  const [failedQuests, setFailedQuests] = useState<string[]>([]);
  const [campaignCompleted, setCampaignCompleted] = useState<boolean>(false);
  const [projectCoverImage, setProjectCoverImage] = useState<string>("");
  const [joinedCampaign, setJoinedCampaign] = useState<boolean>(false);
  const [joiningCampaign, setJoiningCampaign] = useState(false);
  const [campaignReady, setCampaignReady] = useState(false);
  const [campaignRefreshToken, setCampaignRefreshToken] = useState(0);
  const [showProofModal, setShowProofModal] = useState(false);

  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [subTitle, setSubTitle] = useState("");
  const [trustClaimed, setTrustClaimed] = useState(0);
  const [totalTrustAvailable, setTotalTrustAvailable] = useState(0);
  const [maxParticipants, setMaxParticipants] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [projectImage, setProjectImage] = useState("");
  const [hubInfo, setHubInfo] = useState<HubInfo | null>(null);
  const [showHubModal, setShowHubModal] = useState(false);
  const [campaignNumber, setCampaignNumber] = useState("000");
  const [reward, setReward] = useState<{ trustTokens?: number; trust?: number; xp: number; pool?: number }>({ trustTokens: 0, xp: 0 });
  const [campaignAddress, setCampaignAddress] = useState("");
  const [campaignHub, setCampaignHub] = useState("");

  const [questsCompleted, setQuestsCompleted] = useState(false);
  const [proofLinks, setProofLinks] = useState<Record<string, string>>({});
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);

  // Fetch campaign quests
  useEffect(() => {
    (async () => {
      setCampaignReady(false);
      const res = await apiRequestV2("GET", `/api/campaign/quests?id=${campaignId}`);

      // Ensure every quest has a tag to prevent undefined errors
      const safeQuests = (res.campaignQuests || []).map((q: any) => ({
        _id: q._id,
        quest: q.quest,
        status: q.status,
        reward: q.reward ?? 0,
        tag: q.tag ?? "feedback", // default to "other" if missing
        link: q.link ?? "#",
        guildId: q.guildId ?? q.metadata?.guildId ?? "",
        roleId: q.roleId ?? q.metadata?.roleId ?? "",
        channelId: q.channelId ?? q.metadata?.channelId ?? "",
        metadata: q.metadata ?? {},
        done: q.done ?? false,
      }));

      setQuests(safeQuests);
      setJoinedCampaign(Boolean(res.joined));
      setProjectCoverImage(res.projectCoverImage);
      setCampaignCompleted(res.campaignCompleted?.campaignCompleted || false);
      setCampaignAddress(res.address || "");
      setDescription(res.description || "");
      setTitle(res.title || "");
      setSubTitle(res.sub_title || "");
      const nextHubInfo: HubInfo = res.hubInfo ?? {
        name: res.project_name || "Unknown Project",
        description: res.hubDescription || "",
        logo: res.project_image || "",
        website: "",
        xAccount: "",
        discordServer: "",
      };
      setHubInfo(nextHubInfo);
      setProjectName(nextHubInfo.name || res.project_name || "");
      setProjectImage(nextHubInfo.logo || res.project_image || "");
      setCampaignNumber(res.campaignNumber || "000");
      setReward(res.reward || { trustTokens: 0, xp: 0 });
      setTrustClaimed(res.trustClaimed || 0);
      setTotalTrustAvailable(res.totalTrustAvailable || 0);
      setMaxParticipants(res.maxParticipants || 0);
      setQuestsCompleted(res.campaignCompleted?.questsCompleted || false);
      setCampaignHub(res.hub?.toString() || "");
      setCampaignReady(true);

    })();
  }, [campaignId, claimedQuests, userId, campaignRefreshToken]);

  useEffect(() => {
    if (!userId || !campaignId) return;

    const visited =
      JSON.parse(localStorage.getItem("nexura:campaign:visited") || "{}")[userId] || [];

    setVisitedQuests(visited);
  }, [userId]);

  // Sync localStorage for visited
  useEffect(() => {
    const value: Record<string, string[]> = {};
    value[userId] = visitedQuests;

    if (userId) {
      localStorage.setItem('nexura:campaign:visited', JSON.stringify(value))
    }

  }, [visitedQuests, userId]);

  // Open quest links
  const markQuestAsVisited = (quest: Quest) => {
    let url = quest.link?.trim() || "#";
    if (quest.tag === "create-post") {
      url = "https://x.com/compose/post";
    }
    if (url !== "#" && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    window.open(url, "_blank");

    if (!visitedQuests.includes(quest._id)) setVisitedQuests([...visitedQuests, quest._id]);
    if (quest.status === "retry") {
      setRetryQuests([...retryQuests, quest._id]);
      setQuests(prev => prev.map(q => q._id === quest._id ? { ...q, status: "" } : q));
    }
  };

  const retryQuest = async (quest: Quest) => {
    try {
      const link = proofLinks[quest._id];
      if (!link) {
        toast({
          title: "Missing link or username",
          description: "Please paste your comment link or twitter username.",
          variant: "destructive",
        });
        return;
      }

      await apiRequestV2("POST", "/api/quest/update-submission", { submissionLink: link, miniQuestId: quest._id });

      setExpandedQuestId(null);
      setPendingQuests([...pendingQuests, quest._id]);

      toast({
        title: "Submitted",
        description: "Your proof has been submitted for review.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const submitCommentProof = async (quest: Quest) => {
    const link = proofLinks[quest._id];
    if (!link) {
      toast({
        title: "Missing link or username",
        description: "Please paste your comment link or twitter username.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (environment === "production" && !user?.socialProfiles.x.connected) {
        throw new Error("X not connected yet, go to profile to connect.");
      }

      await apiRequestV2("POST", "/api/quest/submit-quest", {
        questId: campaignId,
        id: quest._id,
        submissionLink: link,
        page: "campaign",
        tag: quest.tag,
        hub: campaignHub,
      });

      toast({
        title: "Submitted",
        description: "Your proof has been submitted for review.",
      });

      setExpandedQuestId(null);
      // mark quest as pending
      setPendingQuests([...pendingQuests, quest._id]);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Claim quest
  const getId = (url: string) => {
    return url.split("/").pop(); // return the last item in the array
  };

  const claimQuest = async (quest: Quest) => {
    try {
      if (!joinedCampaign) {
        throw new Error("Join this campaign before completing quests.");
      }

      const id = getId(quest.link);

      try {
        const id = getId(quest.link);
        // if (trustClaimed < 4000) {
          // if (["follow", "comment", "repost"].includes(quest.tag)) {
          //   if (!user?.socialProfiles.x.connected) {
          //     throw new Error("x not connected yet, go to profile to connect.");
          //   }

          //   const { success } = await apiRequestV2("POST", "/api/check-x", { id, tag: quest.tag, questId: quest._id, page: "campaign" });
          //   if (!success) {
          //     throw new Error(`Kindly ${quest.tag !== "follow" ? quest.tag + " the post" : "follow the account"}`);
          //   }
          // } else 
          if (["join", "message", "join-discord", "message-discord", "acquire-role-discord", "send-message-discord"].includes(quest.tag)) {
            if (environment === "production" && !user?.socialProfiles.discord.connected) {
              throw new Error("discord not connected yet, go to profile to connect");
            }

            const isLegacyDiscordTag = ["join", "message", "join-discord", "message-discord"].includes(quest.tag);
            const resolvedGuildId = quest.guildId || quest.metadata?.guildId;
            const resolvedChannelId = quest.channelId || quest.metadata?.channelId || (isLegacyDiscordTag ? id : "");
            const resolvedRoleId = quest.roleId || quest.metadata?.roleId;
            if (environment === "production") {
              const { success } = await apiRequestV2("POST", "/api/check-discord", {
                campaignId,
                id: quest._id,
                tag: quest.tag,
                ...(resolvedGuildId ? { guildId: resolvedGuildId } : {}),
                ...(resolvedChannelId ? { channelId: resolvedChannelId } : {}),
                ...(resolvedRoleId ? { roleId: resolvedRoleId } : {}),
              });

              if (!success) {
                throw new Error(`Kindly ${quest.tag} the discord channel`);
              }
            }
          } else if (quest.tag === "portal") {
            await apiRequestV2("POST", "/api/quest/check-portal-task", { termId: id, id: quest._id, questId: campaignId, page: "campaign" });
          } else if (quest.tag === "trust-name") {
            await apiRequestV2("POST", "/api/quest/check-trust-name", { id: quest._id, campaignId });
          }
        // }
      } catch (error: any) {
        console.error(error);
        throw new Error(error.message);
      }

      if (quest.tag !== "portal" && quest.tag !== "trust-name") {
        const res = await apiRequest(
          "POST",
          `/api/quest/perform-campaign-quest`,
          { id: quest._id, campaignId }
        );

        if (!res.ok) return;
      }

      setClaimedQuests([...claimedQuests, quest._id]);
      setFailedQuests((prev) => prev.filter((id) => id !== quest._id));
      setQuests((prev) =>
        prev.map((q) => (q._id === quest._id ? { ...q, done: true } : q))
      );
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });

      if (!retryQuests.includes(quest._id)) {
        setRetryQuests((prev) => [...prev, quest._id]);
        setQuests(prev => prev.map(q => q._id === quest._id ? { ...q, status: "retry" } : q));
      }
    };
  };

  // Claim campaign reward
  const claimCampaignReward = async () => {
    try {
      if (!joinedCampaign) {
        throw new Error("Join this campaign before claiming rewards.");
      }

      if (!questsCompleted) {
        throw new Error("Kindly complete quests to claim reward");
      }

      setShowProofModal(true);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const finalizeCampaignReward = async (txHash: string) => {
    try {
      if (campaignAddress && trustClaimed < totalTrustAvailable) {
        await claimCampaignOnchainReward({ campaignAddress, userId });
      }

      await apiRequestV2("POST", "/api/user/update-claims-created", { txHash });

      await apiRequestV2("POST", `/api/campaign/complete-campaign?id=${campaignId}`);

      setCampaignCompleted(true);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      throw error;
    }
  };

  const handleJoinCampaign = async () => {
    try {
      if (!user) {
        throw new Error("Please sign in and connect your wallet to join this campaign.");
      }

      setJoiningCampaign(true);
      await apiRequestV2("POST", `/api/campaign/join-campaign?id=${campaignId}`);
      setJoinedCampaign(true);
      setCampaignRefreshToken((prev) => prev + 1);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setJoiningCampaign(false);
    }
  };

  const progressPercentage = quests.length
    ? Math.round((quests.filter(q => q.done).length / quests.length) * 100)
    : 0;
  const trustReward = (reward.trustTokens && reward.trustTokens > 0)
    ? reward.trustTokens
    : (reward.trust && reward.trust > 0)
    ? reward.trust
    : (reward.pool && maxParticipants > 0)
    ? Number((reward.pool / maxParticipants).toFixed(2))
    : (totalTrustAvailable && maxParticipants > 0)
    ? Number((totalTrustAvailable / maxParticipants).toFixed(2))
    : 0;
  const hasTrustReward = Number(reward.pool ?? totalTrustAvailable ?? 0) > 0;
  const activeHubInfo: HubInfo = hubInfo ?? {
    name: projectName || "Unknown Project",
    description: "",
    logo: projectImage || "",
    website: "",
    xAccount: "",
    discordServer: "",
  };

  return (

    <div className="min-h-screen bg-[#0a0615] text-white relative p-6">
      <AnimatedBackground />

      <div className="max-w-4xl mx-auto relative z-10 space-y-10">

        {campaignReady && !joinedCampaign && (
          <Card className="rounded-2xl bg-amber-500/10 border-amber-400/30 text-white shadow-xl">
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-300 uppercase tracking-wide">Join Required</p>
                <p className="text-sm text-white/80 mt-1">You can view this campaign here, but you need to join it before starting quests or claiming rewards.</p>
              </div>
              <Button
                onClick={handleJoinCampaign}
                disabled={joiningCampaign}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl px-5 py-3"
              >
                {joiningCampaign ? "Joining..." : "Join Campaign"}
              </Button>
            </div>
          </Card>
        )}

        {/* Banner with Progress */}
        <div className="w-full bg-gradient-to-r from-purple-700/40 to-purple-900/40 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHubModal(true)}
              className="flex items-center gap-3 sm:gap-4 min-w-0 text-left hover:opacity-90 transition"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-white/10 border border-white/10 shrink-0">
                {activeHubInfo.logo ? (
                  <img
                    src={activeHubInfo.logo}
                    alt={activeHubInfo.name || "Project image"}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="uppercase text-[0.6rem] sm:text-xs opacity-60">Project</p>
                <p className="text-lg sm:text-xl font-semibold truncate">{activeHubInfo.name || "Unknown Project"}</p>
                <p className="text-xs opacity-70 mt-1">View project info</p>
              </div>
            </button>

            {Number(reward.xp) > 0 && (
              <div className="flex items-center gap-2 sm:gap-3">
                <p className="text-[0.65rem] sm:text-sm opacity-70 uppercase">Total XP</p>
                <div className="bg-purple-600/30 border border-purple-500/40 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full flex items-center gap-1 sm:gap-2">
                  <span className="font-bold text-xs sm:text-sm">{reward.xp} XP</span>
                </div>
              </div>
            )}
          </div>

          <div className="w-full bg-white/10 h-2 sm:h-3 rounded-full overflow-hidden mt-2 sm:mt-3">
            <div
              className="h-2 sm:h-3 bg-purple-600 transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-[0.65rem] sm:text-sm opacity-60 mt-1">{progressPercentage}% completed</p>
        </div>

        {/* Main Quest Card */}
        <Card className="rounded-2xl bg-white/5 border-white/10 overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="h-48 md:h-full">
              <img
                src={projectCoverImage}
                alt="campaign cover image"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-5 md:p-6 flex flex-col justify-between">
              <div>
                <p className="text-xs opacity-50 uppercase mb-1">{projectName}</p>
                <p className="text-lg md:text-xl font-bold leading-tight">
                  {title || description || subTitle || `Campaign ${campaignNumber}`}
                </p>

                <div className="mt-4">
                  <p className="uppercase text-xs opacity-50">Campaign Description</p>
                  <p className="text-sm opacity-80 leading-relaxed mt-1">
                    {description || title || subTitle || "Complete quests in this campaign and earn rewards."}
                  </p>
                </div>
                {(Number(reward.xp) > 0 || hasTrustReward) && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs opacity-50 uppercase">Rewards</p>
                    <p className="text-sm">
                      {hasTrustReward && Number(reward.xp) > 0
                        ? `${reward.xp} XP + ${trustReward} $TRUST`
                        : hasTrustReward
                        ? `${trustReward} $TRUST`
                        : `${reward.xp} XP`}
                    </p>
                  </div>
                )}
              </div>

              <Button
                onClick={joinedCampaign ? claimCampaignReward : handleJoinCampaign}
                disabled={joinedCampaign ? (!questsCompleted || campaignCompleted) : joiningCampaign}
                className={`w-full font-semibold rounded-xl py-3 mt-6 ${!campaignCompleted
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : "bg-gray-600 cursor-not-allowed text-gray-300"
                  }`}
              >
                {joinedCampaign
                  ? (campaignCompleted ? "Completed" : "Claim Rewards")
                  : (joiningCampaign ? "Joining..." : "Join Campaign")}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4 sm:space-y-6">
          {quests.length > 0 ? (
            quests.map((quest) => {
              const requiresProof = ["comment", "follow", "comment-x", "follow-x", "repost-x", "feedback", "create-post"].includes(quest.tag);
              const isFeedback = quest.tag === "feedback";
              const isTns = quest.tag === "trust-name";
              const visited = visitedQuests.includes(quest._id);
              const claimed = quest.done || claimedQuests.includes(quest._id);
              const pending = quest.status === "pending" || pendingQuests.includes(quest._id);
              const failed = failedQuests.includes(quest._id);
              const retry = quest.status === "retry";
              const isPortalTask = quest.tag === "portal";
              const isExpanded = expandedQuestId === quest._id;

              let buttonText = "Start Quest";

              if (visited) buttonText = "Claim";
              if (pending) buttonText = "Pending";
              if (claimed) buttonText = "Completed";

              return (
                <div key={quest._id}>
                  <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 hover:bg-white/10 transition gap-3 sm:gap-0">
                    <div className="flex items-center gap-3 w-full sm:w-2/3">
                      <div className="w-6 h-6 sm:w-6 sm:h-6 rounded-full flex items-center justify-center bg-white/10 text-white">
                        {claimed ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Play className="w-4 h-4" />}
                      </div>
                      <span className="text-sm sm:text-base font-medium">{quest.quest}</span>
                      {isPortalTask && !claimed &&
                        <p className="text-sm text-white/70">
                          ⚠️ A minimum of 1 TRUST is required to either oppose or support a proposal before the task can be claimed.
                        </p>
                      }
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      {!visited && !claimed && (
                        <button
                          disabled={!joinedCampaign}
                          onClick={() => markQuestAsVisited(quest)}
                          className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {joinedCampaign ? "Start Quest" : "Join First"}
                        </button>
                      )}
                      {visited && !claimed && !requiresProof && (
                        <button
                          disabled={!joinedCampaign}
                          onClick={() => claimQuest(quest)}
                          className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isTns ? "Verify" : "Claim"}
                        </button>
                      )}
                      {visited && !claimed && requiresProof && !pending && (
                        <button
                          onClick={() => setExpandedQuestId(isExpanded ? null : quest._id)}
                          className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-semibold bg-purple-700 hover:bg-purple-800"
                        >
                          {isFeedback ? "Give Feedback" : "Submit Proof"}
                        </button>
                      )}

                      {claimed && (
                        <span className="text-sm text-green-400 font-semibold">Completed</span>
                      )}
                      {!claimed && pending && requiresProof && (
                        <span className="text-sm text-white font-semibold">Pending Verification</span>
                      )}
                      {!claimed && retry && !isTns && (
                        <button
                          onClick={() => markQuestAsVisited(quest)}
                          className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-semibold bg-orange-600 hover:bg-orange-700"
                        >
                          Retry
                        </button>
                      )}

                      {/* {pending && <button disabled={true} className="text-sm text-white bg-white/10 font-semibold">Pending</button>} */}
                    </div>
                  </div>

                  {isExpanded && requiresProof && (
                    <div className="mt-2 sm:mt-3 bg-black/30 border border-white/10 rounded-xl p-3 sm:p-4 space-y-2">
                      <p className="text-xs text-white/70">
                        ⚠️ It may take 10 minutes up to 24 hours to validate your submission.
                      </p>
                      {isFeedback ? (
                        <>
                          {(() => {
                            const minChars = resolveFeedbackMinChars(quest);
                            const currentLength = proofLinks[quest._id]?.length || 0;
                            return (
                              <>
                                <textarea
                                  placeholder={`Write your feedback here (minimum ${minChars} characters)...`}
                                  value={proofLinks[quest._id] || ""}
                                  onChange={(e) => setProofLinks({ ...proofLinks, [quest._id]: e.target.value })}
                                  rows={5}
                                  maxLength={FEEDBACK_MAX_CHARS}
                                  className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500 resize-none"
                                />
                                <div className="flex items-center justify-between">
                                  <p className={`text-xs ${currentLength < minChars ? "text-red-400" : "text-green-400"}`}>
                                    {currentLength}/{minChars} characters minimum
                                  </p>
                                </div>
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <input
                          type="url"
                          placeholder={quest.tag === "create-post" ? "Paste the link to your post here" : "Paste your comment link or twitter username here"}
                          value={proofLinks[quest._id] || ""}
                          onChange={(e) => setProofLinks({ ...proofLinks, [quest._id]: e.target.value })}
                          className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                        />
                      )}
                      <button
                        onClick={() => {
                          const minChars = resolveFeedbackMinChars(quest);
                          if (isFeedback && (proofLinks[quest._id]?.length || 0) < minChars) {
                            return;
                          }
                          retryQuests.includes(quest._id) ? retryQuest(quest) : submitCommentProof(quest);
                        }}
                        disabled={isFeedback && (proofLinks[quest._id]?.length || 0) < (resolveFeedbackMinChars(quest))}
                        className="w-full bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-900 hover:from-purple-600 hover:via-purple-700 hover:to-indigo-800 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFeedback ? "Submit Feedback" : "Submit for Review"}
                      </button>
                    </div>
                  )}

                </div>
              );
            })
          ) : (
            <p>No campaigns available</p>
          )}
        </div>
      </div>

      <Dialog open={showHubModal} onOpenChange={setShowHubModal}>
        <DialogContent className="w-[94vw] max-w-3xl bg-[#0d1117] border-white/10 text-white p-0 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-4">
            <DialogHeader className="space-y-1">
              <DialogTitle>Project Information</DialogTitle>
              <DialogDescription className="text-white/60">
                Project details and socials.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-[170px,1fr] gap-4 items-start">
              <div className="w-full h-28 sm:h-40 rounded-xl overflow-hidden border border-white/10 bg-white/5">
                {activeHubInfo.logo ? (
                  <img src={activeHubInfo.logo} alt={activeHubInfo.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a2233] to-[#121826] text-white/70 text-2xl font-semibold">
                    {(activeHubInfo.name || "H").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-3">
                <p className="text-lg sm:text-xl font-semibold break-words">{activeHubInfo.name || "Unknown Project"}</p>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs uppercase text-white/50 mb-1.5">Description</p>
                  <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap break-words">
                    {activeHubInfo.description?.trim() ? activeHubInfo.description : "No project description provided."}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/10 space-y-1.5">
                  <p className="text-xs uppercase text-white/50">Socials</p>
                  {activeHubInfo.website?.trim() ? (
                    <a
                      href={activeHubInfo.website.startsWith("http") ? activeHubInfo.website : `https://${activeHubInfo.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 break-all"
                    >
                      <Globe className="w-4 h-4 shrink-0" />
                      Website
                    </a>
                  ) : null}
                  {activeHubInfo.xAccount?.trim() ? (
                    <a
                      href={activeHubInfo.xAccount.startsWith("http")
                        ? activeHubInfo.xAccount
                        : `https://x.com/${activeHubInfo.xAccount.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 break-all"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      X Account
                    </a>
                  ) : null}
                  {activeHubInfo.discordServer?.trim() ? (
                    <a
                      href={activeHubInfo.discordServer.startsWith("http")
                        ? activeHubInfo.discordServer
                        : `https://${activeHubInfo.discordServer}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 break-all"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      Discord Server
                    </a>
                  ) : null}
                  {!activeHubInfo.website?.trim() && !activeHubInfo.xAccount?.trim() && !activeHubInfo.discordServer?.trim() ? (
                    <p className="text-sm text-white/60">No social links added yet.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProofOfActionModal
        open={showProofModal}
        onOpenChange={setShowProofModal}
        object={title || "this campaign"}
        sourceLabel="Campaign"
        onSuccess={finalizeCampaignReward}
        alreadyClaimed={Boolean(campaignCompleted)}
      />
    </div>
  )
};
