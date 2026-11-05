import { projectApiRequest } from "./projectApi";

export type Studio = { id: string; name: string; logo: string };
export type CoHostStatus = "invited" | "accepted" | "declined" | "lapsed" | "expired";
export type CoHostFeeStatus = "none" | "held" | "settled" | "refundDue" | "refunded";

export type CampaignCoHost = { studio: Studio; status: CoHostStatus; invitedAt: string; respondedAt: string | null; ready: boolean; stageKeys: string[]; rewardShare: string; feeStatus: CoHostFeeStatus };
export type CampaignCoHosts = { coHosts: CampaignCoHost[]; launchFee: { total: string; host: string; perCoHost: string }; hostRewardShare: string };

export type CoHostInvite = {
  campaignId: string; title: string; status: string; startsAt: string; endsAt: string; cover: string;
  host: Studio; myStatus: CoHostStatus; ready: boolean; invitedAt: string; invitedBy: string; myStages: string[];
  launchFeeShare: string; rewardShare: string; rewardToken: string; feeStatus: CoHostFeeStatus;
};

export const searchStudios = (q: string) =>
  projectApiRequest<{ studios: Studio[] }>({ method: "GET", endpoint: "/hub/co-hosts/search", params: { q } }).then(r => r.studios ?? []);

export const getCampaignCoHosts = (campaignId: string) =>
  projectApiRequest<CampaignCoHosts>({ method: "GET", endpoint: "/hub/campaign-co-hosts", params: { id: campaignId } });

export const inviteCoHost = (campaignId: string, studioId: string) =>
  projectApiRequest({ method: "POST", endpoint: "/hub/campaign-co-hosts/invite", params: { id: campaignId }, data: { studioId } });

export const removeCoHost = (campaignId: string, studioId: string) =>
  projectApiRequest({ method: "POST", endpoint: "/hub/campaign-co-hosts/remove", params: { id: campaignId }, data: { studioId } });

export const getCoHostInvites = () =>
  projectApiRequest<{ invites: CoHostInvite[] }>({ method: "GET", endpoint: "/hub/co-host-invites" }).then(r => r.invites ?? []);

export const declineCoHostInvite = (campaignId: string) =>
  projectApiRequest({ method: "POST", endpoint: "/hub/co-host-invites/decline", params: { id: campaignId } });

export type CoHostedCampaign = {
  campaign: {
    _id: string; title?: string; description?: string; starts_at?: string; ends_at?: string; status?: string;
    projectCoverImage?: string; rewardsEnabled?: boolean; rewardsConfig?: Record<string, unknown> | null;
    stages?: Array<{ key: string; name: string; returnDays?: number; owner?: string; allocationPct?: number | null }>;
  };
  campaignQuests: Array<{ _id: string; quest?: string; link?: string; stage?: string; order?: number; points?: number; taskTypeId?: string; validationMode?: string; apiEndpoint?: string }>;
  host: Studio;
  me: { studioId: string; ready: boolean; readyAt: string | null; rewardShare: string; launchFeeShare: string; feeStatus: CoHostFeeStatus };
};

export const getCoHostedCampaign = (campaignId: string) =>
  projectApiRequest<CoHostedCampaign>({ method: "GET", endpoint: "/hub/co-hosted-campaign", params: { id: campaignId } });

export const saveCoHostStages = (campaignId: string, stages: unknown[], campaignQuests: unknown[]) =>
  projectApiRequest({ method: "PATCH", endpoint: "/hub/co-hosted-campaign/stages", params: { id: campaignId }, data: { stages, campaignQuests } });

export const markCoHostReady = (campaignId: string) =>
  projectApiRequest({ method: "POST", endpoint: "/hub/co-hosted-campaign/ready", params: { id: campaignId } });
