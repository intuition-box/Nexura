"use client";
import StudioLoader from "@/components/studio/StudioLoader";

import { useState, useEffect, useCallback } from "react";
import { useUrlState } from "@/hooks/use-url-state";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { Card } from "../ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { projectApiRequest, getStoredProjectInfo } from "../../lib/projectApi";
import { useToast } from "../../hooks/use-toast";
import { useWallet } from "../../hooks/use-wallet";
import { ArrowDownToLine, RefreshCw, Trash2, Loader2, Clock, Pencil, Eye, CalendarX2, ImageIcon } from "lucide-react";
import { Button } from "../ui/button";
import { useGovernanceProposer } from "../studio/useGovernanceProposer";
import { apiRequestV2 } from "../../lib/queryClient";
import { closeRewardCampaign, getRewardCampaignCreator, getRewardContractBalance, syncRewardContractStartDate } from "../../lib/performOnchainAction";
import { formatEther } from "viem";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";

interface Campaign {
  _id: string;
  title: string;
  description?: string;
  nameOfProject?: string;
  projectCoverImage?: string;
  starts_at: string;
  ends_at: string;
  status?: string;
  isDraft?: boolean;
  contractAddress?: string;
  rewardsDeployment?: {
    txHash?: string;
    fundedAmount?: number;
    rewardPerParticipant?: number;
    maxClaimableParticipants?: number;
    remainderWithdrawalTxHash?: string;
    remainderWithdrawnAmount?: number;
    remainderWithdrawnAt?: string;
  };
  reward?: { xp?: number; pool?: number; trust?: number };
  updatedAt?: string;
  /** Where the builder was left: drafts reopen on this step. */
  builderState?: { step?: number } | null;
  /** Set once signers approve ending the campaign. */
  endProposal?: { endsAt?: string } | null;
}

type PendingAction = { type: "delete" | "end"; id: string; title: string } | null;

const BUILDER_STEPS = ["Template", "Details", "Journey", "Rewards & Funding", "Review"];
const UNTITLED = "Untitled campaign";

function editedAgo(iso?: string): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (isNaN(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "Edited just now";
  if (mins < 60) return `Edited ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Edited ${hrs}h ago`;
  return `Edited ${new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

const CAMPAIGN_TABS = ["all", "active", "upcoming", "drafts", "completed"] as const;

export default function CampaignsTab() {
  const [activeTab, setActiveTab] = useUrlState("tab", "all", CAMPAIGN_TABS);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [proposingId, setProposingId] = useState<string | null>(null);
  const { gov, propose } = useGovernanceProposer();
  // campaignId -> pending "end campaign" proposal
  const pendingEnds = new Map(
    gov.proposals
      .filter(p => p.status === "pending" && p.action.kind === "endCampaign")
      .map(p => [(p.action as { campaignId: string }).campaignId, p] as const)
  );
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [serverOffset, setServerOffset] = useState<number>(0);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [rewardBalances, setRewardBalances] = useState<Record<string, bigint>>({});
  const router = useRouter();
  const { toast } = useToast();
  const { address, isConnected, connectWallet } = useWallet();

  const info = getStoredProjectInfo();
  const isSuperAdmin = (info?.role as string) === "superadmin";
  const isHubAdmin = isSuperAdmin || (info?.role as string) === "admin";
  const formatTrustAmount = (amountWei: bigint) => {
    const formatted = formatEther(amountWei);
    const numeric = Number(formatted);
    return Number.isFinite(numeric)
      ? numeric.toLocaleString(undefined, { maximumFractionDigits: 4 })
      : formatted;
  };

  useEffect(() => {
    apiRequestV2("GET", `/api/server-time`)
      .then((res: any) => setServerOffset(res.serverTime - Date.now()))
      .catch(() => {});
  }, []);

  /** `quiet` refreshes in the background, without the loading state or error toasts. */
  const fetchCampaigns = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await projectApiRequest<{ hubCampaigns?: Campaign[] }>({
        method: "GET",
        endpoint: "/hub/get-campaigns",
      });
      const next = res.hubCampaigns ?? [];
      // Keep the same list when nothing changed, so reward balances aren't re-read every refresh
      setCampaigns(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    } catch (err: unknown) {
      if (quiet) return;
      const msg = err instanceof Error ? err.message : "Failed to load campaigns.";
      toast({ title: "Error", description: msg, variant: "destructive" });
      setCampaigns([]);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useLiveRefresh(() => fetchCampaigns(true));

  const nowMs = Date.now() + serverOffset;
  const now = new Date(nowMs);

  const isDraft = (c: Campaign) => c.status === "Save";
  const isEnded = (c: Campaign) => c.status === "Ended";
  const isCompleted = (c: Campaign) => c.status === "Ended" || (!!c.ends_at && new Date(c.ends_at) <= now);
  const isScheduled = (c: Campaign) => {
    if (c.status === "Scheduled") return true;
    if (isDraft(c) || isCompleted(c)) return false;
    return !!c.starts_at && new Date(c.starts_at) > now;
  };
  const isActiveCampaign = (c: Campaign) => {
    if (c.status === "Active") return true;
    if (isDraft(c) || isScheduled(c) || isCompleted(c)) return false;
    return true;
  };
  useEffect(() => {
    const currentNow = new Date(Date.now() + serverOffset);
    const completedRewardCampaigns = campaigns.filter((campaign) => {
      const campaignCompleted = campaign.status === "Ended" || (!!campaign.ends_at && new Date(campaign.ends_at) <= currentNow);
      return campaignCompleted && !!campaign.contractAddress && Number(campaign.reward?.pool ?? 0) > 0;
    });

    if (completedRewardCampaigns.length === 0) {
      setRewardBalances({});
      return;
    }

    let cancelled = false;

    const loadBalances = async () => {
      const entries = await Promise.all(
        completedRewardCampaigns.map(async (campaign) => {
          try {
            const balance = await getRewardContractBalance(campaign.contractAddress as string);
            return [campaign._id, balance] as const;
          } catch (error) {
            console.error(`Failed to load rewards contract balance for campaign ${campaign._id}:`, error);
            return [campaign._id, undefined] as const;
          }
        })
      );

      if (cancelled) return;

      setRewardBalances(
        entries.reduce<Record<string, bigint>>((acc, [campaignId, balance]) => {
          if (balance !== undefined) acc[campaignId] = balance;
          return acc;
        }, {})
      );
    };

    void loadBalances();

    return () => {
      cancelled = true;
    };
  }, [campaigns, serverOffset]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setPendingAction(null);
    try {
      await projectApiRequest({ method: "DELETE", endpoint: "/hub/delete-campaign", params: { id } });
      setCampaigns((prev) => prev.filter((c) => c._id !== id));
      toast({ title: "Campaign deleted", description: "The campaign has been removed." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete campaign.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  /** A campaign never ends on the spot: signers approve a proposal, then it ends 7 days later. */
  const handleProposeEnd = async (id: string, title: string) => {
    setProposingId(id);
    setPendingAction(null);
    try {
      const p = await propose(`End campaign: ${title || UNTITLED}`, "Ends the campaign 7 days after approval", { kind: "endCampaign", campaignId: id, campaignTitle: title });
      if (p?.status === "executed") {
        toast({ title: "Campaign ending", description: "Approved. The campaign ends in 7 days." });
        fetchCampaigns();
      } else {
        toast({ title: "Proposal sent", description: "Signers can approve it in Admin Management. Once approved, the campaign ends 7 days later." });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "The proposal could not be sent.";
      if (!/user (rejected|denied)|request rejected|cancel/i.test(msg)) toast({ title: "Not sent", description: msg, variant: "destructive" });
    } finally {
      setProposingId(null);
    }
  };

  const handleWithdrawRemainder = async (campaign: Campaign) => {
    if (!campaign.contractAddress) {
      toast({ title: "No rewards contract", description: "This campaign does not have a rewards contract attached.", variant: "destructive" });
      return;
    }

    setWithdrawingId(campaign._id);
    try {
      let connectedAddress: string | null = address;
      if (!isConnected || !connectedAddress) {
        connectedAddress = await connectWallet({ noReload: true });
      }
      if (!connectedAddress) {
        throw new Error("Connect the wallet that deployed this rewards contract to withdraw the remainder.");
      }

      const campaignCreator = await getRewardCampaignCreator(campaign.contractAddress);
      if (campaignCreator.toLowerCase() !== connectedAddress.toLowerCase()) {
        throw new Error(`Switch to the contract creator wallet ${campaignCreator.slice(0, 6)}...${campaignCreator.slice(-4)} to withdraw the remainder.`);
      }

      let currentBalance: bigint | null = null;
      try {
        currentBalance = await getRewardContractBalance(campaign.contractAddress);
      } catch {
        // Balance check is best-effort; withdrawal can proceed without it
      }

      const txHash = await closeRewardCampaign(campaign.contractAddress);
      const withdrawnAmount = currentBalance !== null ? Number(formatEther(currentBalance)) : 0;

      const syncResults = await Promise.allSettled([
        campaign.status !== "Ended"
          ? projectApiRequest({ method: "PATCH", endpoint: "/hub/close-campaign", params: { id: campaign._id } })
          : Promise.resolve(null),
        projectApiRequest({
          method: "PATCH",
          endpoint: "/hub/record-campaign-rewards-withdrawal",
          data: {
            id: campaign._id,
            withdrawalTxHash: txHash,
            withdrawnAmount,
          },
        }),
      ]);

      const syncFailure = syncResults.find((result) => result.status === "rejected");

      setRewardBalances((prev) => ({ ...prev, [campaign._id]: 0n }));
      await fetchCampaigns();

      if (syncFailure?.status === "rejected") {
        console.error("Campaign withdrawal sync failed:", syncFailure.reason);
        toast({
          title: "Remainder withdrawn",
          description: currentBalance !== null
            ? `${formatTrustAmount(currentBalance)} TRUST was withdrawn on-chain, but the studio metadata needs a refresh.`
            : "TRUST was withdrawn on-chain, but the studio metadata needs a refresh.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Remainder withdrawn",
        description: currentBalance !== null
          ? `${formatTrustAmount(currentBalance)} TRUST was returned from the rewards contract.`
          : "Remaining TRUST was returned from the rewards contract.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to withdraw the remaining rewards.";
      toast({ title: "Withdrawal failed", description: msg, variant: "destructive" });
    } finally {
      setWithdrawingId(null);
    }
  };

  const confirmAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "delete") {
      handleDelete(pendingAction.id);
      return;
    }
    if (pendingAction.type === "end") {
      handleProposeEnd(pendingAction.id, pendingAction.title);
      return;
    }
  };

  useEffect(() => {
    const scheduled = campaigns.filter((c) => isScheduled(c) && c.starts_at);
    if (scheduled.length === 0) return;

    const tick = () => {
      const currentMs = Date.now() + serverOffset;
      const newCountdowns: Record<string, string> = {};
      let anyExpired = false;

      for (const c of scheduled) {
        const diff = new Date(c.starts_at).getTime() - currentMs;
        if (diff <= 0) {
          anyExpired = true;
          newCountdowns[c._id] = "Starting...";
        } else {
          const d = Math.floor(diff / 86400000);
          const h = Math.floor((diff % 86400000) / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          newCountdowns[c._id] = d > 0 ? `${d}d ${h}h ${m}m ${s}s` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
        }
      }

      setCountdowns(newCountdowns);
      if (anyExpired) fetchCampaigns();
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [campaigns, serverOffset, fetchCampaigns]);

  const filteredCampaigns = campaigns.filter((c) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return isActiveCampaign(c);
    if (activeTab === "upcoming") return isScheduled(c);
    if (activeTab === "completed") return isCompleted(c);
    if (activeTab === "drafts") return isDraft(c);
    return true;
  });

  const tabs = [
    { id: "all", label: "All Campaigns", count: campaigns.length },
    { id: "active", label: "Active", count: campaigns.filter((c) => isActiveCampaign(c)).length },
    { id: "upcoming", label: "Upcoming", count: campaigns.filter((c) => isScheduled(c)).length },
    { id: "drafts", label: "Drafts", count: campaigns.filter((c) => isDraft(c)).length },
    { id: "completed", label: "Completed", count: campaigns.filter((c) => isCompleted(c)).length },
  ];

  const CampaignCard = ({ campaign }: { campaign: Campaign }) => {
    const draft = isDraft(campaign);
    const scheduled = isScheduled(campaign);
    const completed = isCompleted(campaign);
    const live = !draft && !completed;
    const title = campaign.title && campaign.title !== UNTITLED ? campaign.title : "";
    const rewardsContractSettled = Boolean(campaign.rewardsDeployment?.remainderWithdrawalTxHash);
    const rewardBalance = rewardBalances[campaign._id];
    const rewardBalanceKnown = rewardBalance !== undefined;
    const hasRewardsContract = !!campaign.contractAddress && Number(campaign.reward?.pool ?? 0) > 0;
    const endPending = pendingEnds.has(campaign._id);
    const busy = deletingId === campaign._id || proposingId === campaign._id || withdrawingId === campaign._id;
    const step = Math.min(5, Math.max(1, Number(campaign.builderState?.step) || 2));

    let status = "Live";
    let statusColor = "bg-[rgba(0,168,124,0.92)] text-white";
    if (draft) { status = "Draft"; statusColor = "bg-[rgba(194,124,0,0.92)] text-white"; }
    else if (scheduled) { status = "Upcoming"; statusColor = "bg-[rgba(47,127,224,0.92)] text-white"; }
    else if (completed) { status = rewardsContractSettled ? "Completed" : "Ended"; statusColor = "bg-[rgba(61,72,92,0.88)] text-white"; }

    const formatDate = (dateStr: string) =>
      new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    const iconBtn = "h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed";

    return (
      <Card className="w-full h-full min-w-0 bg-white text-[#1c2533] border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[28px] overflow-hidden shadow-none flex flex-col transition hover:border-[rgba(138,63,252,0.35)] hover:shadow-[0_8px_24px_rgba(28,37,51,0.06)]">
        <div className="relative h-32 w-full shrink-0">
          {campaign.projectCoverImage && campaign.projectCoverImage !== "pending" ? (
            <img src={campaign.projectCoverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#efe8ff] via-[#f4f1fc] to-[#e6f6ff] flex items-center justify-center">
              <ImageIcon className="w-7 h-7 text-[#b9a8ee]" />
            </div>
          )}
          {scheduled && countdowns[campaign._id] ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[rgba(47,127,224,0.92)] px-2.5 py-1 text-[11px] font-semibold text-white">
              <Clock className="w-3 h-3" /> Starts in {countdowns[campaign._id]}
            </span>
          ) : (
            <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColor}`}>{status}</span>
          )}
        </div>

        <div className="p-4 flex flex-1 flex-col gap-1.5 min-w-0">
          <h3 className={`font-semibold text-[15px] leading-5 truncate ${title ? "text-[#1c2533]" : "text-[#98a0b4] italic"}`} title={title || UNTITLED}>
            {title || UNTITLED}
          </h3>

          {draft ? (
            <>
              <p className="text-[#69728a] text-xs">Step {step} of 5 · {BUILDER_STEPS[step - 1]}</p>
              <div className="h-1.5 w-full rounded-full bg-[#f1edfb] overflow-hidden">
                <div className="h-full rounded-full bg-[#8B3EFE]" style={{ width: `${(step / 5) * 100}%` }} />
              </div>
              {campaign.updatedAt && <p className="text-[#98a0b4] text-[11px]">{editedAgo(campaign.updatedAt)}</p>}
            </>
          ) : (
            <>
              <p className="text-[#69728a] text-xs truncate">{formatDate(campaign.starts_at)} – {formatDate(campaign.ends_at)}</p>
              {Number(campaign.reward?.pool ?? 0) > 0 && (
                <p className="text-[#8a3ffc] text-xs font-semibold truncate">Reward pool: {campaign.reward?.pool} TRUST</p>
              )}
              {live && endPending && (
                <p className="text-[#c27c00] text-xs font-medium">End proposed · waiting for signers</p>
              )}
              {live && !endPending && campaign.endProposal?.endsAt && (
                <p className="text-[#c27c00] text-xs font-medium">Ending {formatDate(campaign.endProposal.endsAt)}</p>
              )}
              {completed && hasRewardsContract && (
                <p className="text-[#00a87c] text-xs font-semibold">
                  {rewardBalanceKnown
                    ? rewardBalance! > 0n ? `Contract remainder: ${formatTrustAmount(rewardBalance!)} TRUST` : "Reward contract settled"
                    : "Checking reward contract..."}
                </p>
              )}
            </>
          )}

          <div className="mt-auto pt-3 flex items-center gap-2">
            {draft ? (
              <button
                className="flex-1 min-w-0 h-9 px-3 text-xs font-semibold text-white bg-[#8B3EFE] rounded-full hover:bg-[#7b35e6] transition truncate"
                onClick={() => router.push(`/studio-dashboard/create-new-campaign?edit=${campaign._id}`)}
              >
                Continue editing
              </button>
            ) : (
              <button
                className="flex-1 min-w-0 h-9 px-3 text-xs font-semibold text-white bg-[#8B3EFE] rounded-full hover:bg-[#7b35e6] transition inline-flex items-center justify-center gap-1.5"
                onClick={() => router.push(`/studio-dashboard/campaign-preview?id=${campaign._id}`)}
              >
                <Eye className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">View details</span>
              </button>
            )}

            {isSuperAdmin && live && (
              <button
                title="Edit campaign"
                className={`${iconBtn} bg-[#f4f1fc] text-[#6e2bd8] hover:bg-[rgba(138,63,252,0.16)]`}
                onClick={() => router.push(`/studio-dashboard/create-new-campaign?edit=${campaign._id}`)}
                disabled={busy}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}

            {isSuperAdmin && live && (
              <button
                title={endPending ? "Ending this campaign is already proposed" : "Propose ending this campaign"}
                className={`${iconBtn} bg-[rgba(245,158,11,0.14)] text-[#c27c00] hover:bg-[rgba(245,158,11,0.22)]`}
                onClick={() => setPendingAction({ type: "end", id: campaign._id, title })}
                disabled={busy || endPending}
              >
                {proposingId === campaign._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarX2 className="w-4 h-4" />}
              </button>
            )}

            {isHubAdmin && completed && hasRewardsContract && !rewardsContractSettled && (
              <button
                title="Withdraw contract remainder"
                className={`${iconBtn} bg-[rgba(0,225,162,0.16)] text-[#00a87c] hover:bg-[rgba(0,225,162,0.24)]`}
                onClick={() => void handleWithdrawRemainder(campaign)}
                disabled={busy}
              >
                {withdrawingId === campaign._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
              </button>
            )}

            {isSuperAdmin && (draft || completed) && (
              <button
                title="Delete campaign"
                className={`${iconBtn} bg-[rgba(248,113,113,0.12)] text-[#e4545b] hover:bg-[rgba(248,113,113,0.22)]`}
                onClick={() => setPendingAction({ type: "delete", id: campaign._id, title: title || UNTITLED })}
                disabled={busy}
              >
                {deletingId === campaign._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-[26px] font-semibold leading-[40.3px] tracking-[-0.65px] text-[#1c2533]">Nexura Studio</h1>
            <p className="text-[#69728a] text-[14px]">Track and manage your community engagement campaigns</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-[#69728a] hover:text-[#1c2533] hover:bg-[rgba(138,63,252,0.06)]"
            onClick={() => fetchCampaigns()}
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex border-b-[0.833px] border-[rgba(28,37,51,0.09)] gap-[2px] overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-[18px] py-[12px] text-[14px] font-semibold transition-colors whitespace-nowrap border-b-[1.667px] ${
                activeTab === tab.id ? "border-[#8a3ffc] text-[#1c2533]" : "border-transparent text-[#69728a] hover:text-[#1c2533]"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {loading ? (
          <StudioLoader message="Loading campaigns…" />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
            {activeTab === "all" && isSuperAdmin && (
              <Link
                href="/studio-dashboard/create-new-campaign"
                className="w-full min-h-[280px] p-6 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[rgba(138,63,252,0.4)] rounded-[28px] bg-white hover:bg-[#f4f1fc] hover:border-[#8B3EFE] transition cursor-pointer no-underline"
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-[16px] bg-[rgba(138,63,252,0.1)] text-[#8a3ffc] text-2xl font-bold">+</div>
                <p className="font-semibold text-[#1c2533] text-center text-lg">Create New Campaign</p>
                <p className="text-[#69728a] text-center text-sm">Launch a New Campaign now</p>
              </Link>
            )}

            {filteredCampaigns.length === 0 ? (
              <p className="text-[#69728a] col-span-full">No campaigns found.</p>
            ) : (
              filteredCampaigns.map((c) => <CampaignCard key={c._id} campaign={c} />)
            )}
          </div>
        )}
      </div>

      <Dialog open={!!pendingAction} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <DialogContent className="bg-white border-[0.833px] border-[rgba(28,37,51,0.15)] text-[#1c2533] rounded-[40px] max-w-md">
          <DialogHeader>
            <DialogTitle
              className={
                pendingAction?.type === "delete"
                  ? "text-[#e4545b]"
                  : "text-[#c27c00]"
              }
            >
              {pendingAction?.type === "delete" ? "Delete Campaign" : "Propose ending this campaign"}
            </DialogTitle>
            <DialogDescription className="text-[#69728a] pt-1">
              {pendingAction?.type === "delete"
                ? (<>This will <span className="text-[#e4545b] font-semibold">permanently delete</span> <span className="text-[#1c2533] font-medium">"{pendingAction?.title}"</span>. This action cannot be undone.</>)
                : (<>Signers vote on this in Admin Management. Once it is approved, <span className="text-[#1c2533] font-medium">"{pendingAction?.title || UNTITLED}"</span> stays open for <span className="font-semibold">7 more days</span> and then ends, so participants get notice. You sign the proposal with your wallet.</>)
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="ghost" className="rounded-[40px] bg-[#f7f4fe] border-[0.833px] border-[rgba(28,37,51,0.15)] text-[#1c2533] hover:bg-[#efeafb]" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              className={
                pendingAction?.type === "delete"
                  ? "rounded-[40px] bg-[#e4545b] hover:bg-[#d4444b] text-white"
                  : "rounded-[40px] bg-[#c27c00] hover:bg-[#a86b00] text-white"
              }
              onClick={confirmAction}
            >
              {pendingAction?.type === "delete" ? "Delete" : "Sign & propose"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
