export const STREAK_MILESTONES = [
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
] as const;

export const claimableStreakMilestone = (streak: number, claimedDay: number) =>
  [...STREAK_MILESTONES].reverse().find(m => streak >= m.day && claimedDay < m.day) ?? null;
