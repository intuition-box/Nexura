import { describe, expect, test } from "bun:test";
import { BUILDER_STATE_VERSION, STEP, migrateBuilderStep } from "./campaignSteps";

describe("builder steps", () => {
  test("steps are in order with no gaps", () => expect(Object.values(STEP)).toEqual([1, 2, 3, 4, 5]));
});

describe("migrating saved drafts", () => {
  test("version 1 drafts already use today's numbering", () => {
    expect(migrateBuilderStep(4, 1)).toBe(STEP.rewards);
    expect(migrateBuilderStep(5, 1)).toBe(STEP.review);
  });
  test("version 2 drafts on the old Co-host step reopen on the Journey", () =>
    expect(migrateBuilderStep(4, 2)).toBe(STEP.journey));
  test("version 2 drafts on Rewards or Review move back one step", () => {
    expect(migrateBuilderStep(5, 2)).toBe(STEP.rewards);
    expect(migrateBuilderStep(6, 2)).toBe(STEP.review);
  });
  test("earlier steps never move", () => {
    expect(migrateBuilderStep(STEP.details, 2)).toBe(STEP.details);
    expect(migrateBuilderStep(STEP.journey, 2)).toBe(STEP.journey);
  });
  test("current drafts are left alone", () =>
    expect(migrateBuilderStep(STEP.review, BUILDER_STATE_VERSION)).toBe(STEP.review));
});
