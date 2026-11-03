"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { apiRequest } from "../lib/queryClient";
import { apiRequestV2 } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Check, Flame, ChevronLeft, ChevronRight, Trophy, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { payRestoreStreakFee } from "../lib/performOnchainAction";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { modalBackdrop, modalPanel } from "../lib/motion";

interface DailyCheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckInSuccess: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// How long the chest reward GIF plays before the XP counter animates in.
// Adjust this to match the actual GIF duration.
const CHEST_GIF_DURATION_MS = 4000;

export default function DailyCheckInModal({ open, onOpenChange, onCheckInSuccess }: DailyCheckInModalProps) {
  const { user, setUser } = useAuth();
  const [checkInDates, setCheckInDates] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [serverDate, setServerDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const { toast } = useToast();
  const [xpThisMonth, setXpThisMonth] = useState(0);
  const [streakLost, setStreakLost] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);
  const [justHitMilestone, setJustHitMilestone] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [displayXp, setDisplayXp] = useState(0);
  const [claimRewardXp, setClaimRewardXp] = useState(0);
  const [claimedDayCount, setClaimedDayCount] = useState(0);
  const [claimLoading, setClaimLoading] = useState(false);
  const [gifLoaded, setGifLoaded] = useState(false);
  const [gifDone, setGifDone] = useState(false);
  const animFrameRef = useRef<number>(0);
  const animateXp = (target: number) => {
  const duration = 2000;
  const startTime = performance.now();

  // Cancel any in-flight animation (cancelAnimationFrame(0) is a safe no-op)
  cancelAnimationFrame(animFrameRef.current);

  const update = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const value = Math.floor(progress * target);
    setDisplayXp(value);

    if (progress < 1) {
      animFrameRef.current = requestAnimationFrame(update);
    }
  };

  animFrameRef.current = requestAnimationFrame(update);
};
  
  useEffect(() => {
    if (open) {
      fetchHistory();
      const now = new Date();
      setViewMonth(now.getMonth());
      setViewYear(now.getFullYear());
    }
  }, [open]);

  

  useEffect(() => {
    if (justClaimed) {
      const timer = setTimeout(() => setJustClaimed(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [justClaimed]);

  useEffect(() => {
    if (claimRewardXp > 0) animateXp(claimRewardXp);
  }, [claimRewardXp]);

  useEffect(() => {
    if (!gifLoaded) return;
    const timer = setTimeout(() => setGifDone(true), CHEST_GIF_DURATION_MS);
    return () => clearTimeout(timer);
  }, [gifLoaded]);


  ///////////// TEST
  const USE_MOCK = false;

const fetchHistory = async () => {
  setIsFetching(true);

  try {
    if (USE_MOCK) {
      const mockUser = {
        streak: 7,
        longestStreak: 45,
        totalCheckIns: 40,
        checkInDates: [
          "2026-05-01",
          "2026-05-02",
          "2026-05-03",
          "2026-05-04",
          "2026-05-05",
          "2026-05-06",
          "2026-05-07",
          "2026-05-08",
          "2026-05-09",
          "2026-05-10",
          "2026-05-11",
          "2026-05-12",
          "2026-05-13",
          "2026-05-14",
          "2026-05-15",
          "2026-05-16",
          "2026-05-17",
          "2026-05-18",
          "2026-05-19",
          "2026-05-20",
          "2026-05-21",
          "2026-05-22",
          "2026-05-23",
          "2026-05-24",
          "2026-05-25",
          "2026-05-26",
          "2026-05-27",
          "2026-05-28",
          "2026-05-29",
          "2026-05-30",
          "2026-05-31"
        ]
      };

      setStreak(mockUser.streak);
      setLongestStreak(mockUser.longestStreak);
      setAlreadyCheckedIn(false);
      setServerDate(new Date().toISOString().split("T")[0]);
      setCheckInDates(mockUser.checkInDates);

      setIsFetching(false);
      return;
    }

    const response = await apiRequest("GET", "/api/user/profile");
    const data = await response.json();

    console.log(data)

    const profileUser = data.user;
    setStreak(profileUser?.streak || 0);
    setLongestStreak(profileUser?.longestStreak || 0);
    setAlreadyCheckedIn(!data.openDailySignIn);
    setClaimedDayCount(profileUser?.dayCount || 0);
    // Sync auth context so user.dayCount stays fresh across components
    setUser((prev: any) => ({ ...prev, ...profileUser }));

    const todayStr = new Date().toISOString().split("T")[0];
    setServerDate(todayStr);
    setCheckInDates(profileUser?.checkInDates || []);

  } catch (err) {
    console.error("[fetchHistory] FAILED:", err);
  } finally {
    setIsFetching(false);
  }
};

const handleCheckIn = async () => {
  if (isLoading) return;
  setIsLoading(true);

  try {
    const response = await apiRequest(
      "POST",
      "/api/user/perform-daily-sign-in"
    );

    const data = await response.json?.();

    console.log("CHECK-IN RESPONSE:", data);

    // 🔥 IMPORTANT: re-sync from backend truth
    await fetchHistory();

    setJustClaimed(true);

    toast({
      title: "Check-in complete!",
      description: "+50 XP earned.",
    });

    onCheckInSuccess?.();

  } catch (error: any) {
    console.error(error);

    toast({
      title: "Error",
      description: error.message || "Failed to check in.",
      variant: "destructive",
    });

  } finally {
    setIsLoading(false);
  }
};

const XPclaimed = async () => {
  try {
    const response = await apiRequestV2(
      "GET",
      "/api/user/daily-xp-details"
    );
    console.log(response)
    
    const xp = response?.dailyXpDetails?.xpClaimedThisMonth ?? 0;
    const lost = response?.dailyXpDetails?.streakLost ?? false;
    
    setXpThisMonth(xp);
    setStreakLost(lost);

  } catch (err) {
    console.log(err);
  }
};

useEffect(() => {
  if (open) {
    XPclaimed();
  }
}, [open]);


  const today = serverDate || new Date().toISOString().split("T")[0];
  const checkInSet = useMemo(() => new Set(checkInDates), [checkInDates]);

  /////////////// NEW MILESTONE PROGRESSION
  
const MILESTONES = [
  { day: 7, xp: 500 },
  { day: 15, xp: 1000 },
  { day: 30, xp: 2500 },
  { day: 45, xp: 5000 },
  { day: 60, xp: 10000 },
  { day: 90, xp: 20000 },
  { day: 130, xp: 22500 },
  { day: 170, xp: 25000 },
  { day: 210, xp: 27500 },
  { day: 250, xp: 30000 },
  { day: 290, xp: 32500 },
  { day: 330, xp: 35000 },
  { day: 365, xp: 50000 },
];

// current milestone user just passed or is working toward
const currentMilestone =
  [...MILESTONES].reverse().find(m => streak >= m.day) || null;

  const claimedMilestone = claimedDayCount;

// next milestone
const nextMilestone =
  MILESTONES.find(m => m.day > streak) || null;
const nextIndex = nextMilestone ? MILESTONES.indexOf(nextMilestone) : MILESTONES.length - 1;
const windowStart = Math.max(0, Math.min(nextIndex - 2, MILESTONES.length - 6));
const visibleMilestones = MILESTONES.slice(windowStart, windowStart + 6);

// progress
const progress = useMemo(() => {
  if (!nextMilestone) return 100;

  const start = currentMilestone?.day ?? 0;
  const end = nextMilestone.day;

  const range = end - start;
  const value = streak - start;

  if (range <= 0) return 100;

  const raw = (value / range) * 100;

  return Math.max(0, Math.min(raw, 100));
}, [streak, currentMilestone, nextMilestone]);

// completion flag (THIS is what your UI should use)
const isMilestoneCompleted =
  MILESTONES.some(m => m.day === streak);

  const completedMilestone =
  [...MILESTONES]
    .reverse()
    .find(m => streak >= m.day) || null;

const daysRemaining = nextMilestone ? nextMilestone.day - streak : 0;

const prevStreakRef = useRef(streak);

const [milestoneEvent, setMilestoneEvent] = useState(false);

useEffect(() => {
  const prev = prevStreakRef.current;

  const hit = MILESTONES.some(
    m => prev < m.day && streak >= m.day
  );

  if (hit) {
    setMilestoneEvent(true);

    // auto reset after animation window
    setTimeout(() => setMilestoneEvent(false), 3000);
  }

  prevStreakRef.current = streak;
}, [streak]);

  const isAtCurrentMilestone = nextMilestone
  ? streak >= nextMilestone.day
  : true;
  
  const daysUntilNext = nextMilestone ? nextMilestone.day - streak : 0;

// const totalCheckIns = checkInDates?.length || 0;
const totalCheckIns = user?.totalCheckIns ?? 0;

const nextMilestoneDay = nextMilestone?.day ?? Infinity;

const canOpenChest =
  completedMilestone &&
  claimedMilestone < completedMilestone.day;


const isBrokenBeforeNextMilestone = useMemo(() => {
  if (!streakLost) return false;
  if (streak === 0) return false;

  return streak < nextMilestoneDay;
}, [streakLost, streak, nextMilestoneDay]);

const handleRestoreStreak = async () => {
  try {
    setIsLoading(true);

    // 1. pay onchain fee
    const txHash = await payRestoreStreakFee();

    // 2. send tx hash to backend
    await apiRequestV2(
      "POST",
      `/api/user/restore-streak?transactionHash=${txHash}`
    );

    // 3. refresh state
    await fetchHistory();
    await XPclaimed();

    toast({
      title: "Streak restored",
      description: "Your streak has been successfully restored.",
    });

  } catch (err) {
    console.log("restore error:", err);

    toast({
      title: "Restore failed",
      description: "Payment or restore process failed.",
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
};

const handleClaimReward = async () => {
  if (claimLoading) return;
  setClaimLoading(true);
  try {
    const res = await apiRequest("POST", "/api/user/claim-streak-reward");
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || data?.message || "Claim failed");
    const rewardXp = data?.streakReward || 0;
    setClaimed(true);
    setClaimRewardXp(rewardXp);
    setClaimLoading(false);
    // Fire-and-forget background refresh — don't await to avoid re-renders
    // that swap the video's event handlers mid-playback
    apiRequest("GET", "/api/user/profile")
      .then(r => r.json())
      .then(j => { if (j?.user) setUser((prev: any) => ({ ...prev, ...j.user })); })
      .catch(() => {});
    fetchHistory();
    XPclaimed();
    toast({ title: "Streak reward claimed!", description: `+${rewardXp} XP` });
  } catch (err) {
    setClaimLoading(false);
    toast({ title: "Claim failed", description: (err as any)?.message || "Could not claim streak reward", variant: "destructive" });
  }
};

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#100721] w-[93vw] max-w-sm p-0 overflow-hidden font-geist">
        {/* Header */}
<div className="px-3 pt-2 pb-1 text-center">
  <DialogHeader>
    <DialogTitle className="text-base text-white flex items-center justify-center gap-2">
      {/* <img src="/daily.png" alt="" className="w-5 h-5" /> */}
      Daily Check-In
    </DialogTitle>

    <DialogDescription className="text-[#A78BFA99] text-[10px] justify-center text-center items-center">
      Build your streak, earn XP, and grow your Nexon progression.
    </DialogDescription>
  </DialogHeader>

  {/* Streak Circle */}
  <div className="mt-2 flex justify-center">
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
  width: "100px",
  height: "100px",
  background: streakLost
  ? "linear-gradient(135deg, #230A14F2, #0F0812FA)"
  : "linear-gradient(135deg, #1E123CE5, #0F0A1EF2)",
  border: "4px solid #8B5CF6",
}}
    >
      {/* inner thin border */}
      <div
        className="absolute inset-[3px] rounded-full"
        style={{
          border: "1px solid #8B5CF633",
        }}
      />

      {/* content */}
      <div className="relative flex flex-col items-center justify-center text-center">
        <img
  src={streakLost ? "/broken-fire.png" : "/fire.png"}
  alt=""
  className="w-6 h-6 mb-1"
/>

<div className="text-sm text-white">
  {streakLost
    ? `${streak} DAY${streak === 1 ? "" : "S"}`
    : streak}
</div>

<div className="text-[8px] text-white/50 tracking-widest mt-0.5">
  {streakLost
    ? "STREAK BROKEN"
    : `DAY${streak === 1 ? "" : "S"} STREAK`}
</div>
      </div>
    </div>
  </div>

  {/* Below Circle Text */}
  <div className="mt-0.5 text-center">
    <div className="text-sm font-medium text-white">
  {streakLost ? "Streak Lost" : "Current Streak"}
</div>
    <div className="text-[10px] text-[#A78BFAA6] -mt-1 pb-1">
  {streakLost
    ? "You missed your check-in. Your streak has been reset."
    : nextMilestone
      ? `${daysUntilNext} day${daysUntilNext === 1 ? "" : "s"} until your next milestone`
      : "All milestones completed"}
</div>
  </div>
</div>

{/* Stats Cards */}
<div className="px-3 grid grid-cols-2 gap-2 -mt-5">

{/* LEFT CARD - NEXT MILESTONE */}
<div
  className="rounded-2xl px-4 py-0.5 flex flex-col justify-between relative"
  style={{
    background: "linear-gradient(135deg, #8B5CF614, #581CDC0D)",
    border: "1px solid #8B5CF633",
  }}
>

  {/* HEADER */}
  <div>
    <div className="text-[10px] text-[#8B5CF6B2] tracking-wider mb-0.5 pt-1">
      {streakLost ? "MILESTONE PROGRESS" : "NEXT MILESTONE"}
    </div>

    <div className="text-sm text-white">
      {nextMilestone ? `${nextMilestone.day} Days` : "Completed"}
    </div>
  </div>

  {/* PROGRESS + REWARD */}
  <div className="mt-1 flex items-center justify-between gap-2 w-full">

    {/* PROGRESS */}
    <div className="flex-1 min-w-0">

      <div className="w-full h-0.5 rounded-full bg-[#FFFFFF14] overflow-hidden relative">

        {/* NORMAL PROGRESS */}
        <div
          className="h-full rounded-full absolute left-0 top-0"
          style={{
            width: `${Math.min(progress, 100)}%`,
            background: "linear-gradient(90deg, #7C3AED, #A78BFA)",
          }}
        />

        {/* BROKEN STREAK OVERLAY */}
        {streakLost && (
          <div
            className="h-full absolute top-0"
            style={{
              left: `${Math.max(progress - 12, 0)}%`,
              width: "12%",
              background:
                "linear-gradient(90deg, #F87171, rgba(248,113,113,0.2))",
            }}
          />
        )}

      </div>

      <div className="text-[10px] text-[#A78BFA8C] mt-1 leading-relaxed">
        {MILESTONES.some(m => streak >= m.day) ? (
          <span className="text-[9px] tracking-wide flex items-center gap-1">
            <span className="text-[#A78BFA]">100%</span>
            <span>complete</span>
          </span>
        ) : (
          <>
            <span className="text-[#A78BFA8C]">{daysRemaining}</span>
            <span className="ml-1">days left</span>
          </>
        )}
      </div>

    </div>

{/* REWARD BOX */}
<div
  className={`relative shrink-0 flex flex-col items-center justify-center ${
    canOpenChest ? "-mt-8" : "-mt-4"
  }`}
>
  <div className="relative">

    <img
      src="/reward-box.png"
      alt=""
      className="w-16 h-16 object-contain"
    />

    {/* XP PILL */}
    {!canOpenChest && (
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2 px-1 py-0.5 rounded-full text-[8px] whitespace-nowrap"
        style={{
          background: "#200D4FEE",
          border: "1px solid #8B5CF64D",
          color: "#fff",
        }}
      >
        +{new Intl.NumberFormat().format(nextMilestone?.xp || 0)} XP
      </div>
    )}
  </div>

  {canOpenChest && (
    <video muted playsInline preload="auto" aria-hidden className="hidden">
      <source src="/chest.webm" type="video/webm" />
      <source src="/chest.mp4" type="video/mp4" />
    </video>
  )}
  {/* OPEN CHEST */}
  {canOpenChest && (
    <button
      type="button"
      onClick={() => { setClaimed(false); setDisplayXp(0); setClaimRewardXp(0); setGifLoaded(false); setGifDone(false); setChestOpen(true); }}
      className="relative z-10 px-2 py-[2px] rounded-full bg-[#8B3EFE] text-white text-[8px] leading-none hover:opacity-90 transition"
    >
      Open Chest
    </button>
  )}
</div>

  </div>
</div>

{/* RIGHT CARD - YOUR STATS */}
<div
  className="rounded-2xl p-2 flex flex-col"
  style={{
    background: "linear-gradient(135deg, #8B5CF614, #581CDC0D)",
    border: "1px solid #8B5CF633",
  }}
>
  <div className="text-[10px] text-[#8B5CF6B2] tracking-wider mb-1">
    YOUR STATS
  </div>

  {/* XP */}
  <div className="flex justify-between items-center">
    <span className="text-[10px] text-[#A78BFA8C]">
      XP claimed this month
    </span>
    <span className="text-[##E9D5FF] text-[10px]">
      {new Intl.NumberFormat().format(xpThisMonth)}
    </span>
  </div>

  <div className="h-[1px] bg-[#8B5CF61A] my-0.5" />

  {/* Longest Streak */}
  <div className="flex justify-between items-center">
    <span className="text-[10px] text-[#A78BFA8C]">
      Longest Streak
    </span>
    <span className="text-[#E9D5FF] text-[10px]">
      {longestStreak} days
    </span>
  </div>

  <div className="h-[1px] bg-[#8B5CF61A] my-0.5" />

  {/* Check-ins */}
  <div className="flex justify-between items-center">
    <span className="text-[10px] text-[#A78BFA8C]">
      Total Check-Ins
    </span>
    <span className="text-[##E9D5FF] text-[10px]">
      {totalCheckIns}
    </span>
  </div>
</div>
</div>

{/* Milestone Title */}
<div className="px-3 pt-0.5 -mt-3 w-full">
  <div className="text-[9px] text-[#8B5CF6B2] tracking-wider mb-1">
    MILESTONE PROGRESSION
  </div>

{/* Card */}
<div
  className="rounded-2xl p-3 w-full overflow-hidden"
  style={{
    background: "linear-gradient(135deg, #8B5CF614, #581CDC0D)",
    border: "1px solid #8B5CF633",
  }}
>
  {/* TRACK */}
  <div className="relative flex items-start w-full">

    {visibleMilestones.map((m, i, arr) => {
      const isLast = i === arr.length - 1;

// user has already redeemed this milestone
const reached = claimedDayCount >= m.day;

// user is exactly at milestone but NOT claimed yet
const isAtCheckpoint = streak >= m.day && claimedDayCount < m.day;

// future milestone
const isUpcoming = streak < m.day;
      const isNext = m.day === nextMilestone?.day;
      const isNextBroken = isNext && isBrokenBeforeNextMilestone;

      return (
        <div
          key={m.day}
          className="relative flex-1 flex flex-col items-center min-w-0"
        >

          {/* CONNECTOR LINE */}
          {!isLast && (
            <div
              className="absolute top-[10px] left-1/2 h-[1.5px] z-0"
              style={{
                width: "100%",
                background: reached
                  ? "linear-gradient(90deg, #7C3AED, rgba(167,139,250,0.35))"
                  : "rgba(255,255,255,0.12)",
              }}
            />
          )}

          {/* NODE */}
          <div
            className="relative w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 backdrop-blur-sm"
            style={{
              background: isNextBroken
                ? "#F87171"
                : reached
                  ? "linear-gradient(135deg, #6D28D9, #7C3AED)"
                  : "rgba(255,255,255,0.03)",

              border: isNextBroken
                ? "1px solid #EF4444"
                : reached
                  ? "1px solid #8B5CF699"
                  : "1px solid rgba(255,255,255,0.08)",

              boxShadow: reached
                ? "0 0 10px rgba(139,92,246,0.35)"
                : "none",
            }}
          >
{isNextBroken ? (
  <X className="w-3 h-3 text-white" />

) : reached ? (
  // CLAIMED → check
  <Check className="w-3 h-3 text-white" />

) : isAtCheckpoint ? (
  // EARNED BUT NOT CLAIMED → purple badge
  <span
    className="text-white text-[8px] font-semibold px-1 py-[3px] rounded-full"
    style={{
      background: "linear-gradient(135deg, #8B3EFE, #6D28D9)",
      border: "1px solid #8B5CF64D",
      boxShadow: "0 0 8px rgba(139,62,254,0.25)",
    }}
  >
    {m.day}
  </span>

) : (
  // FUTURE → locked
  <img
    src="/padlock.png"
    className="w-2.5 h-2.5 opacity-20 blur-[0.3px]"
  />
)}
          </div>

          {/* XP */}
          <div
            className="mt-1 px-1.5 py-[1px] rounded-full text-[7px] whitespace-nowrap"
            style={{
              background: isNextBroken
                ? "#F8717133"
                : "#6D28D94D",

              border: isNextBroken
                ? "1px solid #F8717166"
                : "1px solid #8B5CF64D",

              color: isNextBroken ? "#F87171" : "#fff",
            }}
          >
            {new Intl.NumberFormat().format(m.xp)} XP
          </div>

          {/* LABEL */}
          <div
            className="text-[8px] mt-0.5 text-center leading-tight"
            style={{
              color: isNextBroken
                ? "#F87171"
                : "#A78BFAB2",
            }}
          >
            {m.day} Days
          </div>

        </div>
      );
    })}
  </div>
</div>
</div>

{/* STREAK RESTORATION CARD */}
{streakLost && (
  <div
    className="-mt-2 mx-4 rounded-2xl px-3 py-2 flex items-center justify-between gap-2"
    style={{
      background: "linear-gradient(135deg, #1E0E3299, #0F081CB2)",
      border: "1px solid #8B5CF626",
    }}
  >
    {/* LEFT SIDE */}
    <div className="w-[70%]">
      <div className="text-sm text-white">
        Streak Restoration
      </div>

      <p className="text-[10px] leading-relaxed mt-1 text-[#A78BFA80]">
        You can restore your streak for 1 TRUST.
      </p>
    </div>

    {/* RIGHT SIDE */}
    <div className="w-[30%] flex justify-end">
      <button
  onClick={handleRestoreStreak}
  disabled={isLoading}
  className="px-4 py-2 rounded-xl text-[10px] font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
  style={{
    background: "transparent",
    border: "2px solid #8B5CF666",
    color: "#A78BFA",
  }}
>
  Restore Streak
</button>
    </div>
  </div>
)}

        {/* Check-in button */}
        <div className="px-5 pb-4">
          <button
            onClick={handleCheckIn}
            disabled={alreadyCheckedIn || isLoading || isFetching}
            className={`w-full py-2 rounded-2xl text-xs transition-all duration-300 ${
              alreadyCheckedIn
                ? "bg-white/5 border border-white/10 text-white/40 cursor-default"
                : "bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:opacity-90 hover:shadow-[0_0_20px_rgba(131,58,253,0.5)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
            }`}
          >
            {isFetching
              ? "Loading..."
              : isLoading
                ? "Checking in..."
                : alreadyCheckedIn
                  ? "Checked In"
                  : "Check In  (+50 XP)"}
          </button>
        </div>
      </DialogContent>
    </Dialog>

{chestOpen &&
  createPortal(
    <motion.div
      key="chest-open-overlay"
      variants={modalBackdrop}
      initial="initial"
      animate="animate"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black"
      style={{ pointerEvents: "auto" }}
    >

      {/* OUTSIDE CLICK LAYER */}
      <div
        className="absolute inset-0"
        onClick={() => { setClaimed(false); setDisplayXp(0); setClaimRewardXp(0); setChestOpen(false); }}
        style={{ pointerEvents: "auto" }}
      />

      {/* MODAL */}
      <motion.div
        variants={modalPanel}
        className="relative z-10 w-[85%] max-w-xs text-center"
        style={{ pointerEvents: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* badge */}
        <div className="flex items-center justify-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-2 py-1 mb-3">
          <div className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-purple-300 text-[9px] font-medium uppercase tracking-widest">
            Reward Chest
          </span>
        </div>

        {/* title */}
        <h2 className="text-white text-sm font-semibold mb-1">
          {claimed ? "Rewards Claimed" : "Your Reward Awaits"}
        </h2>

        {/* description */}
        <p className="text-white/60 text-[10px] mb-3 leading-relaxed">
          {claimed
            ? "Your Streak Progression has been updated."
            : "A reward chest has been unlocked for your streak."}
        </p>

        {/* MEDIA SECTION */}
        <div className="relative w-full mb-2 rounded-lg overflow-hidden">

          {/* BEFORE CLAIM → SHOW IMAGE */}
          {!claimed && (
            <img
              src="/chest-.png"
              alt="chest"
              className="w-full h-auto object-cover"
            />
          )}

          {/* AFTER CLAIM → PLAY GIF (once) */}
          {claimed && !gifDone && (
            <video
              autoPlay muted playsInline preload="auto"
              className="w-full h-auto object-cover"
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse 72% 72% at 50% 48%, #000 55%, transparent 92%)",
                maskImage:
                  "radial-gradient(ellipse 72% 72% at 50% 48%, #000 55%, transparent 92%)",
              }}
              onPlaying={() => setGifLoaded(true)}
            >
              <source src="/chest.webm" type="video/webm" />
              <source src="/chest.mp4" type="video/mp4" onError={() => setGifDone(true)} />
            </video>
          )}
        </div>

        {claimed && (
          <div className="mb-3">
            <div className="text-[#E990F7] text-3xl font-bold">
              +{displayXp} XP
            </div>
          </div>
        )}

        {/* hint */}
{!claimed ? (
  <p className="text-white/50 text-[9px] mb-3">
    Tap the chest to reveal your reward.
  </p>
) : (
  <div className="mb-3">
    <h2 className="text-white text-xl mb-2">
      Rewards Claimed!
    </h2>

    <p className="text-white/60 text-[9px] mb-2">
      Your Streak Progression has been updated.
    </p>
  </div>
)}

  {/* BUTTON */}
  {!claimed ? (
  <button
    onClick={handleClaimReward}
    disabled={claimLoading}
    className="w-full py-1.5 rounded-2xl bg-[#8B3EFE] text-white text-xs font-medium transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {claimLoading ? "Claiming..." : "Claim Rewards"}
  </button>
) : (
  <button
    onClick={() => { setClaimed(false); setDisplayXp(0); setChestOpen(false); }}
    className="w-full py-1.5 rounded-2xl bg-[#8B3EFE] text-white text-xs font-medium transition hover:opacity-90"
  >
    View Progression
  </button>
)}

      </motion.div>
    </motion.div>,
    document.body
  )
}
</>
  );
}