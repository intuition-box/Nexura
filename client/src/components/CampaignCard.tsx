import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Clock, ExternalLink, Users } from "lucide-react";
import { useLocation } from "wouter";
import { dummyCampaigns } from "../types/dummyCampaign";

interface CampaignCardProps {
  title: string;
  description?: string;
  project_name: string;
  projectLogo: string;
  projectCoverImage: string;
  participants: number;
  maxParticipants?: number;
  starts_at: string;
  ends_at: string;
  isLive?: boolean;
  reward?: {
    xp: string | number;
    trustTokens?: string | number;
    trust?: string | number;
    pool?: string | number;
  };
  totalTrustAvailable?: number;
  _id?: string;
  from?: string;
}

export default function CampaignCard({
  title,
  description,
  project_name,
  projectCoverImage,
  participants,
  maxParticipants,
  starts_at,
  ends_at,
  isLive = true,
  reward,
  totalTrustAvailable,
  _id,
  from,
}: CampaignCardProps) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    if (_id && isLive) {
      const url = from
        ? `/campaign/${_id}?from=${from}`
        : `/campaign/${_id}`;

      setLocation(url);
    }
  };

const formatDuration = (
  startDate: string,
  endDate: string
) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const sameYear =
    start.getFullYear() === end.getFullYear();

  const startFormatted = start.toLocaleDateString(
    "en-GB",
    sameYear
      ? {
          day: "numeric",
          month: "long",
        }
      : {
          day: "numeric",
          month: "long",
          year: "numeric",
        }
  );

  const endFormatted = end.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  return `${startFormatted} – ${endFormatted}`;
};

  const allowedParticipants =
    maxParticipants && maxParticipants > 0
      ? maxParticipants
      : participants;

  const trustReward = reward
    ? Number(reward.trustTokens) > 0
      ? Number(reward.trustTokens)
      : Number(reward.trust) > 0
      ? Number(reward.trust)
      : Number(reward.pool) > 0 && allowedParticipants > 0
      ? Number(
          (Number(reward.pool) / allowedParticipants).toFixed(2)
        )
      : totalTrustAvailable &&
        totalTrustAvailable > 0 &&
        allowedParticipants > 0
      ? Number(
          (totalTrustAvailable / allowedParticipants).toFixed(2)
        )
      : 0
    : 0;

  const hasTrustReward =
    Number(reward?.pool ?? totalTrustAvailable ?? 0) > 0;

  return (
    <Card
      onClick={handleClick}
      className="bg-[#170F1F] h-full border border-white/5 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition cursor-pointer flex flex-col"
    >
      {/* Campaign Banner */}
      <div className="relative h-36 bg-black w-full overflow-hidden">
        <img
          src={projectCoverImage}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Status */}
        <div className="absolute top-2 right-2">
          {isLive ? (
            <Badge className="bg-[#00E1A24D] text-[#00E1A2] rounded-2xl text-xs sm:text-xs">
              ACTIVE 
            </Badge>
          ) : (
            <Badge className="bg-gray-500/20 text-gray-200 border border-gray-500/30 text-[0.65rem] sm:text-xs">
              Ended
            </Badge>
          )}
        </div>

        {/* PROJECT LOGO */}
<div className="absolute bottom-3 left-3">
  <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 bg-[#1D1526] backdrop-blur-md shadow-lg">
    <img
      src={projectCoverImage || "/quest-1.png"}
      alt={project_name || "Project"}
      className="w-full h-full object-cover"
    />
  </div>
</div>

      </div>

      {/* CONTENT */}
        <div
  className="relative overflow-hidden p-1 flex flex-col flex-1 rounded-b-2xl"
  style={{
    background: "#170F1F",
    borderTop: "1px solid rgba(131, 58, 253, 0.12)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    boxShadow: "inset 0 0 22px rgba(131, 58, 253, 0.10)",
  }}
>
  {/* BACKGROUND GLOW */}
  <div
    className="absolute w-56 h-56 rounded-full pointer-events-none"
    style={{
      background: "#833AFD",
      top: "-90px",
      right: "-90px",
      filter: "blur(70px)",
      opacity: 0.35,
    }}
  />

  {/* CONTENT */}
        <div className="relative p-2 sm:p-2 flex flex-1 flex-col space-y-1">
        {/* Title */}
        <h2
          className="text-sm font-semibold text-white leading-snug line-clamp-2 min-h-[2.25rem] break-words"
          title={title}
        >
          {title}
        </h2>

        {/* Description */}
<div className="h-[40px]">
  {description ? (
    <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
      {description}
    </p>
  ) : (
    <p className="text-xs opacity-0">
      placeholder
    </p>
  )}
</div>

        {/* Project */}
        <div className="flex flex-row justify-between text-xs gap-1 items-center">
          <span className="text-gray-500">
            Project:
          </span>

          <span
            className="text-white line-clamp-1 break-all max-w-[65%] text-right"
            title={project_name}
          >
            {project_name}
          </span>
        </div>

        {/* Participants */}
        <div className="flex flex-row justify-between text-xs gap-1 items-center">
          <span className="text-gray-500">
            Participants:
          </span>

          <span className="text-white flex items-center gap-1">
            <Users className="w-3 h-3" />
            {(participants ?? 0).toLocaleString()}
          </span>
        </div>

        {/* Rewards */}
        {(Number(reward?.xp) > 0 || hasTrustReward) && (
          <div className="flex flex-row justify-between text-xs items-center">
            <span className="text-gray-500">
              Reward:
            </span>

            <span className="text-white flex items-center gap-1 text-right">
              {hasTrustReward &&
              Number(reward?.xp) > 0
                ? `${trustReward} TRUST + ${reward?.xp} XP`
                : hasTrustReward
                ? `${trustReward} TRUST`
                : `${reward?.xp} XP`}
            </span>
          </div>
        )}

        {/* Duration */}
        <div className="flex flex-row justify-between text-xs items-center">
          <span className="text-gray-500">
            Duration:
          </span>

          <span className="text-white flex items-center gap-1 text-right">
            <Clock className="w-3 h-3" />
            {formatDuration(starts_at, ends_at)}
          </span>
        </div>

        {/* Button */}
        <button
          className={`w-full mt-auto pt-2 py-2 text-xs font-medium rounded-xl transition ${
            isLive
              ? "bg-[#8B3EFE] hover:bg-[#B65FC8] text-white"
              : "bg-gray-600 cursor-not-allowed text-gray-300"
          }`}
          disabled={!isLive}
        >
          {isLive ? (
            <span className="flex items-center justify-center">
              <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Start Campaign
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Campaign Ended
            </span>
          )}
        </button>
      </div>
      </div>
    </Card>
  );
}