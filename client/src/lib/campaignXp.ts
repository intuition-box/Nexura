/*
 * Campaign XP, the same rule the server pays by (server/src/utils/campaignXp.ts):
 * - One-time campaign (a single stage): 1,000 XP.
 * - Campaign with retention stages: 2,500 XP, split equally across the stages.
 * Each stage's share is paid when the person completes that stage.
 */
export const ONE_TIME_CAMPAIGN_XP = 1000;
export const RETENTION_CAMPAIGN_XP = 2500;

/** XP for each stage, in order (whole numbers that add up exactly to the total). */
export function stageXpShares(stageCount: number): number[] {
  if (stageCount <= 1) return [ONE_TIME_CAMPAIGN_XP];
  const base = Math.floor(RETENTION_CAMPAIGN_XP / stageCount);
  const extra = RETENTION_CAMPAIGN_XP - base * stageCount;
  return Array.from({ length: stageCount }, (_, i) => base + (i < extra ? 1 : 0));
}

export const campaignXpTotal = (stageCount: number) => stageXpShares(stageCount).reduce((a, b) => a + b, 0);
