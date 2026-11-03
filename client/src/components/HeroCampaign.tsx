"use client";

import { Badge } from "./ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Campaign {
  /** What the reward pool pays in (TRUST, USDC, …); older campaigns have none and pay TRUST */
  rewardAsset?: { token?: string; network?: string };
  _id: string;
  title: string;
  description: string;
  project_name: string;
  projectLogo: string;
  participants: number;
  maxParticipants?: number;
  starts_at: string;
  ends_at?: string;
  status: string;
  reward?: {
    xp: string | number;
    trustTokens?: string | number;
    trust?: string | number;
    pool?: string | number;
  };
  totalTrustAvailable?: number;
  heroImage?: string;
  projectCoverImage?: string;
}

interface HeroCampaignProps {
  campaigns: Campaign[];
}

export default function HeroCampaign({ campaigns }: HeroCampaignProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const currentCampaign = campaigns[currentIndex];

  const handleCampaignClick = () => {
    if (currentCampaign && currentCampaign.status === "Active") {
      router.push(`/campaign/${currentCampaign._id}`);
    }
  };

  const formatParticipants = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) {
      return { month: "TBA", day: "—", time: "TBA" };
    }
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return { month: "TBA", day: "—", time: "TBA" };
    }
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const time = date.toLocaleDateString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
    return { month, day, time };
  };

  const nextCampaign = () => {
    setCurrentIndex((prev) => (prev + 1) % campaigns.length);
  };

  const prevCampaign = () => {
    setCurrentIndex((prev) => (prev - 1 + campaigns.length) % campaigns.length);
  };

  if (!currentCampaign) return null;

  const starts_at = formatDate(currentCampaign.starts_at);
  const ends_at = formatDate(currentCampaign.ends_at);
  const allowedParticipants = currentCampaign.maxParticipants && currentCampaign.maxParticipants > 0
    ? currentCampaign.maxParticipants
    : currentCampaign.participants;
  const trustReward = currentCampaign.reward
    ? ((Number(currentCampaign.reward.trustTokens) > 0)
      ? Number(currentCampaign.reward.trustTokens)
      : (Number(currentCampaign.reward.trust) > 0)
      ? Number(currentCampaign.reward.trust)
      : (Number(currentCampaign.reward.pool) > 0 && allowedParticipants > 0)
      ? Number((Number(currentCampaign.reward.pool) / allowedParticipants).toFixed(2))
      : (currentCampaign.totalTrustAvailable && currentCampaign.totalTrustAvailable > 0 && allowedParticipants > 0)
      ? Number((currentCampaign.totalTrustAvailable / allowedParticipants).toFixed(2))
      : 0)
    : 0;
  const heroHeading = currentCampaign.title || currentCampaign.description || "Untitled Campaign";
  const heroBody = currentCampaign.description || currentCampaign.title || "Explore this campaign and earn rewards.";

  return (
    <div
    className="relative h-[24rem] sm:h-96 glass rounded-3xl overflow-hidden mb-6 cursor-pointer group"
      onClick={handleCampaignClick}
      data-testid="hero-campaign-card"
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
        style={{ backgroundImage: `url(${currentCampaign.heroImage || currentCampaign.projectCoverImage || "/campaign.png"})` }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Navigation Arrows */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          prevCampaign();
        }}
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 glass hover:bg-white/20 rounded-full flex items-center justify-center transition-all duration-300"
        data-testid="button-prev-campaign"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          nextCampaign();
        }}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 glass hover:bg-white/20 rounded-full flex items-center justify-center transition-all duration-300"
        data-testid="button-next-campaign"
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>

      <div className="relative h-full flex flex-col sm:flex-row items-start sm:items-center">
        <div className="flex-1 min-w-0 p-4 sm:p-8">
          {/* Participant Count */}
          <div className="text-white/80 text-sm mb-2">
            {formatParticipants(allowedParticipants ?? 0)} participants
          </div>

          {/* Campaign Label */}
          <div className="text-white/60 text-sm mb-2">Campaign</div>


          {/* Campaign Title */}
          <h1 className="text-xl sm:text-3xl font-bold text-white mb-2 sm:mb-3 break-words line-clamp-2">
            {heroHeading}
          </h1>

          {/* Campaign Description */}
          <p className="text-sm sm:text-base text-white/80 mb-3 sm:mb-4 max-w-full sm:max-w-xl break-words line-clamp-3">
            {heroBody}
          </p>

          {/* Date and Status */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 mb-3 sm:mb-4">
            <div className="flex items-center space-x-2">
              <div className="text-center">
                <div className="text-white font-bold text-lg">{starts_at.month}</div>
                <div className="text-white font-bold text-2xl">{starts_at.day}</div>
              </div>
              <div className="text-white/60 text-sm">
                <div>{starts_at.time}</div>
                <div>to {ends_at.time}</div>
              </div>
            </div>

            {currentCampaign.status === "Active" && (
              <Badge className="bg-green-500 text-white">
                <div className="w-2 h-2 bg-white rounded-full mr-2"></div>
                Live
              </Badge>
            )}
          </div>

          {/* Reward Pool */}
          {currentCampaign.reward && (Number(currentCampaign.reward.xp) > 0 || trustReward > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/60 text-sm">Total Rewards Pool</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-white font-bold text-sm sm:text-base break-words">
                  {Number(currentCampaign.reward.xp) > 0 && `${currentCampaign.reward.xp} XP`}
                  {Number(currentCampaign.reward.xp) > 0 && trustReward > 0 && " + "}
                  {trustReward > 0 && `${trustReward} ${currentCampaign.rewardAsset?.token || "TRUST"}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3D Hexagonal Logo Display */}
        <div className="hidden sm:flex flex-shrink-0 mt-6 sm:mt-0 sm:pr-8 justify-center sm:justify-end">
          <div className="relative">
            {/* 3D Hexagonal Base */}
            <div className="relative w-32 h-32 sm:w-48 sm:h-48">
              {/* Base hexagon */}
              <div className="absolute inset-0 transform perspective-1000 rotate-x-20">
                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 clip-hexagon transform-3d"></div>
              </div>

              {/* Top hexagon */}
              <div className="absolute inset-4 transform perspective-1000 rotate-x-20 translate-y-2">
                <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-700 clip-hexagon transform-3d"></div>
              </div>

              {/* Project Logo */}
              <div className="absolute inset-8 flex items-center justify-center">
                <div className="w-16 h-16 sm:w-24 sm:h-24 bg-black rounded-full flex items-center justify-center border-4 border-white/20">
                  <img
                    src="/3D%20LOGO.png"
                    alt={currentCampaign.project_name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
        {campaigns.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(index);
            }}
            className={`w-2 h-2 rounded-full transition-colors ${index === currentIndex ? 'bg-white' : 'bg-white/40'
              }`}
            data-testid={`pagination-dot-${index}`}
          />
        ))}
      </div>
    </div>
  );
}
