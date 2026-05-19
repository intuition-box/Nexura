import { useEffect, useState, useCallback } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { ExternalLink, Clock, Users, Globe } from "lucide-react";
import { useLocation } from "wouter";
import AnimatedBackground from "../components/AnimatedBackground";
import { apiRequestV2 } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../lib/auth";
import { useWallet } from "../hooks/use-wallet";

interface HubInfo {
  id?: string;
  name: string;
  description?: string;
  logo?: string;
  website?: string;
  xAccount?: string;
  discordServer?: string;
  guildId?: string;
}

interface Campaign {
  _id: string;
  title: string;
  description: string;
  project_name: string;
  projectCoverImage: string;
  participants: number;
  maxParticipants?: number;
  starts_at?: string;
  ends_at?: string;
  metadata?: string;
  totalTrustAvailable?: number;
  reward: { trustTokens?: number; trust?: number; xp: number; pool?: number };
  joined: boolean;
  status?: string;
  hubInfo?: HubInfo;
}

export default function Campaigns() {
  const { user } = useAuth();
  const { isConnected: walletConnected, connectWallet } = useWallet();

  const [, setLocation] = useLocation();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingCampaign, setLoadingCampaign] = useState<string | null>(null);
  const [serverOffset, setServerOffset] = useState<number>(0);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const [selectedHub, setSelectedHub] = useState<HubInfo | null>(null);

  const { toast } = useToast();

  const now = Date.now() + serverOffset;

  const isEndedCampaign = (campaign: Campaign) =>
    campaign.status === "Ended" || (!!campaign.ends_at && new Date(campaign.ends_at).getTime() <= now);
  const isScheduledCampaign = (campaign: Campaign) => !isEndedCampaign(campaign) && !!campaign.starts_at && new Date(campaign.starts_at).getTime() > now;
  const isActiveCampaign = (campaign: Campaign) => !isScheduledCampaign(campaign) && !isEndedCampaign(campaign);

  // Fetch server time offset once
  useEffect(() => {
    const fetchServerTime = async () => {
      try {
        const res = await apiRequestV2("GET", `/api/server-time`);
        setServerOffset(res.serverTime - Date.now());
      } catch {
        // fallback: assume no offset
      }
    };
    fetchServerTime();
  }, []);

  const fetchCampaignsData = useCallback(async () => {
    try {
      const res = await apiRequestV2("GET", `/api/campaigns`);
      setCampaigns(res.campaigns);
      setIsLoading(false);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch campaigns initially and every 5 minutes
  useEffect(() => {
    fetchCampaignsData();
    const interval = setInterval(fetchCampaignsData, 300000);
    return () => clearInterval(interval);
  }, [fetchCampaignsData]);

  // Countdown ticker for scheduled campaigns
  useEffect(() => {
    const scheduled = campaigns.filter((c) => isScheduledCampaign(c) && c.starts_at);
    if (scheduled.length === 0) return;

    const tick = () => {
      const nowMs = Date.now() + serverOffset;
      const newCountdowns: Record<string, string> = {};
      let anyExpired = false;

      for (const c of scheduled) {
        const diff = new Date(c.starts_at!).getTime() - nowMs;
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
      if (anyExpired) fetchCampaignsData();
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [campaigns, serverOffset, fetchCampaignsData]);

  const goToCampaign = async (campaign: Campaign, active: boolean) => {
    if (!active) return;

    try {
      setLoadingCampaign(campaign._id);

      if (!walletConnected || !user) {
        const connectedAddress = await connectWallet({ noReload: true });
        if (!connectedAddress) {
          setLoadingCampaign(null);
          toast({ title: "Wallet required", description: "Please connect and sign in with your wallet to join campaigns.", variant: "destructive" });
          return;
        }
      }

      if (campaign.joined) {
        setLocation(`/campaign/${campaign._id}`);
        setLoadingCampaign(null);
        return;
      }

      await apiRequestV2("POST", `/api/campaign/join-campaign?id=${campaign._id}`);
      setCampaigns((prev) =>
        prev.map((c) =>
          c._id === campaign._id
            ? { ...c, joined: true }
            : c
        )
      );
      setLocation(`/campaign/${campaign._id}`);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoadingCampaign(null);
    }
  };

  const allCampaigns = [...campaigns];
  const websiteHref = selectedHub?.website?.trim()
    ? (selectedHub.website.startsWith("http") ? selectedHub.website : `https://${selectedHub.website}`)
    : "";
  const xHref = selectedHub?.xAccount?.trim()
    ? (selectedHub.xAccount.startsWith("http")
      ? selectedHub.xAccount
      : `https://x.com/${selectedHub.xAccount.replace(/^@/, "")}`)
    : "";
  const discordHref = selectedHub?.discordServer?.trim()
    ? (
      selectedHub.discordServer.startsWith("http")
        ? selectedHub.discordServer
        : (selectedHub.guildId ? `https://discord.com/channels/${selectedHub.guildId}` : "")
    )
    : (selectedHub?.guildId ? `https://discord.com/channels/${selectedHub.guildId}` : "");

  const activeCampaigns = allCampaigns.filter((c) => isActiveCampaign(c));

  const upcomingCampaigns = allCampaigns.filter((c) => isScheduledCampaign(c));

  const endedCampaigns = allCampaigns.filter((c) => isEndedCampaign(c));

  const renderCampaignCard = (campaign: Campaign, state: "active" | "upcoming" | "ended") => {
    const isActive = state === "active";
    const isUpcoming = state === "upcoming";
    let metadata: any = {};
    try {
      metadata = campaign.metadata ? JSON.parse(campaign.metadata) : {};
    } catch {
      metadata = {};
    }

    const starts_atFormatted = campaign.starts_at
      ? new Date(campaign.starts_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" })
      : "";
    const ends_atFormatted = campaign.ends_at
      ? new Date(campaign.ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "long" })
      : "TBA";
    const allowedParticipants = campaign.maxParticipants && campaign.maxParticipants > 0
      ? campaign.maxParticipants
      : campaign.participants;
    const trustReward = (campaign.reward?.trustTokens && campaign.reward.trustTokens > 0)
      ? campaign.reward.trustTokens
      : (campaign.reward?.trust && campaign.reward.trust > 0)
      ? campaign.reward.trust
      : (campaign.reward?.pool && allowedParticipants > 0)
      ? Number((campaign.reward.pool / allowedParticipants).toFixed(2))
      : (campaign.totalTrustAvailable && allowedParticipants > 0)
      ? Number((campaign.totalTrustAvailable / allowedParticipants).toFixed(2))
      : 0;
    const hasTrustReward = Number(campaign.reward?.pool ?? campaign.totalTrustAvailable ?? 0) > 0;
    const hubInfo: HubInfo = campaign.hubInfo ?? {
      name: campaign.project_name || "Unknown Project",
      description: "",
      logo: "",
      website: "",
      xAccount: "",
      discordServer: "",
      guildId: "",
    };

    return (
      <Card
        key={campaign._id}
        className="bg-[#0d1117] h-full border border-white/5 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition flex flex-col"
      >
        {/* Campaign Banner */}
        <div className="relative h-36 bg-black w-full">
          {campaign.projectCoverImage && (
            <img
              src={campaign.projectCoverImage}
              alt={campaign.title || campaign.description}
              className="w-full h-full object-cover rounded-t-2xl"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Status Badge / Countdown */}
          <div className="absolute top-2 right-2">
            {isActive ? (
              <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 text-[0.65rem] sm:text-xs">
                Active
              </Badge>
            ) : isUpcoming ? (
              <div className="bg-black/60 backdrop-blur-sm border border-purple-500/30 rounded-lg px-2 py-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-purple-400 animate-pulse" />
                <span className="text-purple-300 text-[0.6rem] sm:text-xs font-mono font-semibold">
                  {countdowns[campaign._id] || "Loading..."}
                </span>
              </div>
            ) : (
              <Badge className="bg-gray-500/20 text-gray-200 border border-gray-500/30 text-[0.65rem] sm:text-xs">
                Ended
              </Badge>
            )}
          </div>

          {/* Category */}
          {metadata.category && (
            <div className="absolute top-2 left-2 text-[0.65rem] sm:text-xs text-white/80 font-medium">
              {metadata.category}
            </div>
          )}
        </div>

        {/* Campaign Details */}
        <div className="p-3 sm:p-4 flex flex-1 flex-col space-y-1.5">
          <h2
          className="text-sm font-semibold text-white leading-snug line-clamp-2 min-h-[2.25rem] break-words"
          title={campaign.title || campaign.description}
          >
          {campaign.title || campaign.description}
          </h2>

          <div className="flex flex-row justify-between text-xs gap-1 items-center">
            <span className="text-gray-500">Project:</span>
            <button
              type="button"
              className="text-white underline-offset-2 hover:underline line-clamp-1 break-all max-w-[65%] text-right"
              title={hubInfo.name}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedHub(hubInfo);
              }}
            >
              {hubInfo.name}
            </button>
          </div>

          <div className="flex flex-row justify-between text-xs gap-1 items-center">
            <span className="text-gray-500">Participants:</span>
            <span className="text-white flex items-center gap-1">
              <Users className="w-3 h-3" />
              {(campaign.participants ?? 0).toLocaleString()}
              {campaign.maxParticipants && campaign.maxParticipants > 0 && (
                <span className="text-gray-500">/ {campaign.maxParticipants.toLocaleString()}</span>
              )}
            </span>
          </div>

          {(Number(campaign.reward?.xp) > 0 || hasTrustReward) && (
            <div className="flex flex-row justify-between text-xs items-center">
              <span className="text-gray-500">Reward:</span>
              <span className="text-white flex items-center gap-1 text-right">
                {hasTrustReward && Number(campaign.reward?.xp) > 0
                  ? `${trustReward} TRUST + ${campaign.reward.xp} XP`
                  : hasTrustReward
                  ? `${trustReward} TRUST`
                  : `${campaign.reward.xp} XP`}
              </span>
            </div>
          )}

          {Number(campaign.reward?.pool) > 0 && (
            <div className="flex flex-row justify-between text-xs items-center">
              <span className="text-gray-500">Reward Pool:</span>
              <span className="text-white flex items-center gap-1 text-right">
                {campaign.reward.pool} TRUST (FCFS)
              </span>
            </div>
          )}

          {campaign.starts_at && (
            <div className="flex flex-row justify-between text-xs items-center">
              <span className="text-gray-500">Duration:</span>
              <span className="text-white flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {starts_atFormatted} – {ends_atFormatted}
              </span>
            </div>
          )}

          <Button
            className={`w-full mt-auto pt-2 py-2 text-xs font-medium rounded-xl ${loadingCampaign === campaign._id
              ? "bg-gray-600 cursor-not-allowed text-gray-300"
              : isActive
                ? "bg-[#1f6feb] hover:bg-[#388bfd] text-white"
                : "bg-gray-600 cursor-not-allowed text-gray-300"
              }`}
            onClick={(e) => {
              e.stopPropagation();
              goToCampaign(campaign, isActive);
            }}
            disabled={loadingCampaign === campaign._id || !isActive}
          >
            {loadingCampaign === campaign._id ? (
              <>Joining...</>
            ) : isActive && campaign.joined ? (
              <>
                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                View Campaign
              </>
            ) : isActive && (!walletConnected || !user) ? (
              <>Connect Wallet</>
            ) : isActive ? (
              <>
                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Join Campaign
              </>
            ) : isUpcoming ? (
              <>
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Starts in {countdowns[campaign._id] || "..."}
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Campaign Ended
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-auto p-6 relative">
      <AnimatedBackground />
      <div className="max-w-4xl sm:max-w-6xl mx-auto space-y-6 sm:space-y-8 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-purple-400 text-xs font-semibold uppercase tracking-widest">Campaigns</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent mb-2">Campaigns</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Complete unique tasks and earn rewards in the Nexura ecosystem.
          </p>
        </div>

        {/* Active Campaigns */}
        <div className="space-y-4 sm:space-y-6">
          <h2 className="text-lg sm:text-2xl font-semibold text-white">Active Campaigns</h2>
          {isLoading ? (
            <div className="text-center py-6 sm:py-12 text-muted-foreground">Loading campaigns...</div>
          ) : activeCampaigns.length === 0 ? (
            <Card className="glass glass-hover rounded-3xl p-6 sm:p-8 text-center">
              <p className="text-white/60">No active campaigns at the moment. Check back soon!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {activeCampaigns.map((campaign) => renderCampaignCard(campaign, "active"))}
            </div>
          )}
        </div>

        {/* Upcoming Campaigns */}
        <div className="space-y-4 sm:space-y-6 mt-8 sm:mt-12">
          <h2 className="text-lg sm:text-2xl font-semibold text-white">Upcoming Campaigns</h2>
          {isLoading ? (
            <div className="text-center py-6 sm:py-12 text-muted-foreground">Loading campaigns...</div>
          ) : upcomingCampaigns.length === 0 ? (
            <Card className="glass glass-hover rounded-3xl p-6 sm:p-8 text-center">
              <p className="text-white/60">No upcoming campaigns.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {upcomingCampaigns.map((campaign) => renderCampaignCard(campaign, "upcoming"))}
            </div>
          )}
        </div>

        {/* Ended Campaigns */}
        <div className="space-y-4 sm:space-y-6 mt-8 sm:mt-12">
          <h2 className="text-lg sm:text-2xl font-semibold text-white">Ended Campaigns</h2>
          {isLoading ? (
            <div className="text-center py-6 sm:py-12 text-muted-foreground">Loading campaigns...</div>
          ) : endedCampaigns.length === 0 ? (
            <Card className="glass glass-hover rounded-3xl p-6 sm:p-8 text-center">
              <p className="text-white/60">No ended campaigns yet.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {endedCampaigns.map((campaign) => renderCampaignCard(campaign, "ended"))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedHub} onOpenChange={(open) => { if (!open) setSelectedHub(null); }}>
        <DialogContent className="w-[94vw] max-w-3xl bg-[#0d1117] border-white/10 text-white p-0 overflow-hidden">
          {selectedHub && (
            <div className="p-4 sm:p-5 space-y-4">
              <DialogHeader className="space-y-1">
                <DialogTitle>Project Information</DialogTitle>
                <DialogDescription className="text-white/60">
                  Project details and socials.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-[170px,1fr] gap-4 items-start">
                <div className="w-full h-28 sm:h-40 rounded-xl overflow-hidden border border-white/10 bg-white/5">
                  {selectedHub.logo ? (
                    <img src={selectedHub.logo} alt={selectedHub.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a2233] to-[#121826] text-white/70 text-2xl font-semibold">
                      {(selectedHub.name || "H").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-3">
                  <p className="text-lg sm:text-xl font-semibold break-words">{selectedHub.name || "Unknown Project"}</p>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase text-white/50 mb-1.5">Description</p>
                    <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap break-words">
                      {selectedHub.description?.trim() ? selectedHub.description : "No project description provided."}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <p className="text-xs uppercase text-white/50">Socials</p>
                    <div className="flex items-center gap-3">
                      {websiteHref ? (
                        <a
                          href={websiteHref}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Project website"
                          title="Website"
                          className="w-10 h-10 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
                        >
                          <Globe className="w-4 h-4 text-blue-300" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          aria-label="Project website not set"
                          title="Website not set"
                          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 opacity-40 cursor-not-allowed flex items-center justify-center"
                        >
                          <Globe className="w-4 h-4 text-white/70" />
                        </button>
                      )}

                      {xHref ? (
                        <a
                          href={xHref}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Project X account"
                          title="X account"
                          className="w-10 h-10 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
                        >
                          <img src="/x-logo-icon.png" alt="X" className="w-4 h-4 object-contain" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          aria-label="Project X account not set"
                          title="X account not set"
                          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 opacity-40 cursor-not-allowed flex items-center justify-center"
                        >
                          <img src="/x-logo-icon.png" alt="X" className="w-4 h-4 object-contain" />
                        </button>
                      )}

                      {discordHref ? (
                        <a
                          href={discordHref}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Project Discord server"
                          title="Discord server"
                          className="w-10 h-10 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
                        >
                          <img src="/discord-logo-icon.png" alt="Discord" className="w-4 h-4 object-contain" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          aria-label="Project Discord not set"
                          title="Discord not set"
                          className="w-10 h-10 rounded-full border border-white/10 bg-white/5 opacity-40 cursor-not-allowed flex items-center justify-center"
                        >
                          <img src="/discord-logo-icon.png" alt="Discord" className="w-4 h-4 object-contain" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50">Icons are clickable only when links are set.</p>
                    <p className="text-[11px] text-white/60">
                      Discord server: {selectedHub.discordServer?.trim() || (selectedHub.guildId ? "Connected" : "Not connected")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
