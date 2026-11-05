/** Campaign builder steps in order. Use these names, never bare numbers. */
export const STEP = { template: 1, details: 2, journey: 3, rewards: 4, review: 5 } as const;

/**
 * Version 1: Rewards 4, Review 5 (today's numbering).
 * Version 2: had a separate Co-host step 4, so Rewards was 5 and Review 6.
 * Version 3: co-hosting moved to a question on Details; back to five steps.
 */
export const BUILDER_STATE_VERSION = 3;

/** A step saved by an older builder, in today's numbering. */
export function migrateBuilderStep(step: number, version: number): number {
  if (version !== 2) return step;
  if (step === 4) return STEP.journey;
  return step > 4 ? step - 1 : step;
}
