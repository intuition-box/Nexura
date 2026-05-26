import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { Check, Flame, ChevronLeft, ChevronRight, Trophy, X } from "lucide-react";

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

export default function DailyCheckInModal({ open, onOpenChange, onCheckInSuccess }: DailyCheckInModalProps) {
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
  const MOCK_TODAY = new Date("2026-05-25T00:00:00Z");

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

  const fetchHistory = async () => {
    setIsFetching(true);
    try {
      const response = await apiRequest("GET", "/api/user/profile");
      const data = await response.json();
    
      const user = data.user;
      setStreak(user?.streak || 0);
      setLongestStreak(user?.longestStreak || 0);
      // openDailySignIn is true when user has NOT signed in today
      setAlreadyCheckedIn(!data.openDailySignIn);
      const todayStr = new Date().toISOString().split("T")[0];
      setServerDate(todayStr);
      setCheckInDates(user?.checkInDates || []);
    } catch {
      // silently fail
    } finally {
      setIsFetching(false);
    }
  };

// const fetchHistory = async () => {
//   setIsFetching(true);

//   try {
//     // HARD-CODED TEST DATA
//     const data = {
//       user: {
//         streak: 3,
//         longestStreak: 10,
//         checkInDates: [
//           "2026-05-20",
//           "2026-05-21",
//           "2026-05-22",
//           "2026-05-23",
//         ],
//       },
//       openDailySignIn: true,
//     };

//     // FIXED "NOW" FOR STREAK TESTING
//     const MOCK_TODAY = "2026-05-25";
//     setServerDate(MOCK_TODAY);

//     const user = data.user;

//     setStreak(user.streak);
//     setLongestStreak(user.longestStreak);

//     // true = user has NOT signed in today
//     setAlreadyCheckedIn(!data.openDailySignIn);

//     setCheckInDates(user.checkInDates || []);
//   } catch (err) {
//     console.error("Mock fetch failed:", err);
//   } finally {
//     setIsFetching(false);
//   }
// };

  const handleCheckIn = async () => {
    if (alreadyCheckedIn || isLoading) return;
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/user/perform-daily-sign-in");
      setAlreadyCheckedIn(true);
      setJustClaimed(true);
      setStreak((s) => s + 1);
      const today = serverDate || new Date().toISOString().split("T")[0];
      setCheckInDates((prev) => [...prev, today]);
      toast({ title: "Check-in complete!", description: "+20 XP earned" });
      onCheckInSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to check in",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const today = serverDate || new Date().toISOString().split("T")[0];
  const checkInSet = useMemo(() => new Set(checkInDates), [checkInDates]);

  /////////////// NEW MILESTONE PROGRESSION

  const MILESTONES = [
    { day: 7, xp: 500, label: "7" },
    { day: 15, xp: 1000, label: "15" },
    { day: 30, xp: 2500, label: "30" },
    { day: 45, xp: 5000, label: "45" },
    { day: 60, xp: 10000, label: "60" },
    { day: 90, xp: 20000, label: "90" },
  ];
  
  const nextMilestone = MILESTONES.find(m => m.day > streak);
  const previousMilestone = [...MILESTONES].reverse().find(m => m.day <= streak);
  
  const daysUntilNext = nextMilestone ? nextMilestone.day - streak : 0;
  const nextXP = nextMilestone?.xp || previousMilestone?.xp || 0;

const currentMilestone = [...MILESTONES]
  .slice()
  .reverse()
  .find(m => m.day <= streak);

const progressStart = currentMilestone?.day || 0;
const progressEnd = nextMilestone?.day || progressStart;

const progress =
  nextMilestone
    ? ((streak - progressStart) / (progressEnd - progressStart)) * 100
    : 100;

const daysRemaining = nextMilestone ? nextMilestone.day - streak : 0;

// const totalCheckIns = checkInDates?.length || 0;
const totalCheckIns = useMemo(() => {
  return Array.isArray(checkInDates) ? checkInDates.length : 0;
}, [checkInDates]);

const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();

const checkInsThisMonth = checkInDates.filter((date) => {
  const d = new Date(date);
  return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
});

// ⚠️ placeholder ONLY if backend doesn't provide XP
const xpThisMonth = checkInsThisMonth.length * 20; // temporary fallback

const lastCheckInDate = useMemo(() => {
  if (!checkInDates.length) return null;
  return new Date(checkInDates[checkInDates.length - 1]);
}, [checkInDates]);

const streakLost = useMemo(() => {
  if (!lastCheckInDate) return false;

  const now = new Date();

  const diffInDays = Math.floor(
    (now.getTime() - lastCheckInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return diffInDays >= 1;
}, [lastCheckInDate]);

const nextMilestoneDay = nextMilestone?.day ?? Infinity;

const isBrokenBeforeNextMilestone = useMemo(() => {
  if (!streakLost) return false;
  if (streak === 0) return false;

  return streak < nextMilestoneDay;
}, [streakLost, streak, nextMilestoneDay]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#100721] backdrop-blur-3xl border border-[#FFFFFF4D] rounded-3xl w-[93vw] max-w-sm p-0 overflow-hidden font-geist">
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
  className="rounded-2xl px-4 py-0.5 flex flex-col justify-between"
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
<div className="mt-1 flex items-center justify-between gap-2">

  {/* PROGRESS */}
  <div className="flex-1">
    <div className="w-full h-0.5 rounded-full bg-[#FFFFFF14] overflow-hidden relative">

      {/* NORMAL PURPLE PROGRESS */}
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
      {nextMilestone ? (
        <>
          <span className="text-[#A78BFA8C]">
            {daysRemaining}
          </span>{" "}
          days left
        </>
      ) : (
        "All milestones reached"
      )}
    </div>
  </div>

  {/* REWARD BOX (FIXED ALIGNMENT TO END OF BAR) */}
  <div className="relative shrink-0 flex items-center justify-center -mt-4">
    <div className="relative">
      
      <img
        src="/reward-box.png"
        alt=""
        className="w-16 h-16 object-contain"
      />

      {/* XP PILL */}
      <div
        className="absolute -top-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] whitespace-nowrap"
        style={{
          background: "#200D4FEE",
          border: "1px solid #8B5CF64D",
          color: "#fff",
        }}
      >
        +{new Intl.NumberFormat().format(nextMilestone?.xp || 0)} XP
      </div>

    </div>
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
    <span className="text-white text-[12px]">
      {new Intl.NumberFormat().format(xpThisMonth)}
    </span>
  </div>

  <div className="h-[1px] bg-[#8B5CF61A] my-0.5" />

  {/* Longest Streak */}
  <div className="flex justify-between items-center">
    <span className="text-[10px] text-[#A78BFA8C]">
      Highest Streak
    </span>
    <span className="text-white text-[12px]">
      {longestStreak} days
    </span>
  </div>

  <div className="h-[1px] bg-[#8B5CF61A] my-0.5" />

  {/* Check-ins */}
  <div className="flex justify-between items-center">
    <span className="text-[10px] text-[#A78BFA8C]">
      Total Check-Ins
    </span>
    <span className="text-white text-[12px]">
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
    className="rounded-2xl p-3 w-full"
    style={{
      background: "linear-gradient(135deg, #8B5CF614, #581CDC0D)",
      border: "1px solid #8B5CF633",
    }}
  >

    {/* TRACK */}
    <div className="relative flex w-full">

      {MILESTONES.map((m, i, arr) => {
        const isLast = i === arr.length - 1;

        const reached = streak >= m.day;
        const isCurrent = streak === m.day;
        const isNext = m.day === nextMilestone?.day;
        const isNextBroken = isNext && isBrokenBeforeNextMilestone;

        return (
          <div
            key={m.day}
            className="relative flex-1 flex flex-col items-center px-[2px]"
          >

            {/* CONNECTOR LINE */}
            {!isLast && (
              <div
                className="absolute top-[10px] left-1/2 w-full h-[1px] -z-10"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  transform: "translateX(50%)",
                }}
              />
            )}

            {/* NODE */}
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10"
              style={{
                background: isNextBroken
                  ? "#F87171"
                  : reached
                    ? "linear-gradient(135deg, #6D28D9, #7C3AED)"
                    : "transparent",

                border: isNextBroken
                  ? "1px solid #EF4444"
                  : "1px solid #8B5CF64D",
              }}
            >
              {isNextBroken ? (
                <X className="w-3 h-3 text-white" />
              ) : reached ? (
                isCurrent ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <span className="text-white text-[9px]">
                    {m.day}
                  </span>
                )
              ) : (
                <img src="/padlock.png" className="w-3 h-3 opacity-80" />
              )}
            </div>

            {/* XP */}
            <div
              className="mt-0.5 px-1.5 py-[1px] rounded-full text-[8px] whitespace-nowrap"
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
              className="text-[8.5px] mt-0.5 text-center leading-tight"
              style={{
                color: isNextBroken ? "#F87171" : "#A78BFAB2",
              }}
            >
              {m.label}
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
        Use at least 5 TRUST to buy into a Nexura-built Intuition claim and
        restore your streak progression.
      </p>
    </div>

    {/* RIGHT SIDE */}
    <div className="w-[30%] flex justify-end">
      <button
        className="px-4 py-2 rounded-xl text-[10px] font-medium whitespace-nowrap"
        style={{
          background: "transparent",
          border: "1px solid #8B5CF666",
          color: "#A78BFA",
        }}
      >
        Restore Streak
      </button>
    </div>
  </div>
)}

        {/* Check-in button */}
        <div className="px-5 pb-2">
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
                  : "Check In  (+20 XP)"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
