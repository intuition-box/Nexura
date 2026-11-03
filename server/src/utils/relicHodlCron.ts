import { runRelicHodlCheck } from "@/controllers/app.controller";
import logger from "@/config/logger";
import { runExclusively } from "@/utils/jobLock";

const RELIC_HODL_CHECK_INTERVAL_MS = 10 * 60 * 1000;

let isRunning = false;

async function runRelicHodlCheckGuarded() {
  if (isRunning) return;
  isRunning = true;
  try {
    // One server per pass, so rewards are never given twice when more servers run
    await runExclusively("relic-hodl-check", RELIC_HODL_CHECK_INTERVAL_MS - 30_000, runRelicHodlCheck);
  } finally {
    isRunning = false;
  }
}

export function startRelicHodlCron() {
  runRelicHodlCheckGuarded();

  setInterval(() => {
    runRelicHodlCheckGuarded();
  }, RELIC_HODL_CHECK_INTERVAL_MS);

  logger.info("Relic hodl cron job started (10m interval)");
}
