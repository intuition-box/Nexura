import { randomUUID } from "crypto";
import { redis } from "@/config/redis";
import logger from "@/config/logger";

const redisReady = () => { try { return redis.isReady; } catch { return false; } };

/**
 * Runs `job` on only one server at a time. With several servers, each scheduled pass takes a short
 * Redis lock first; the servers that don't get it skip that pass. Without Redis there is only this
 * process to coordinate with, so the job runs.
 */
export async function runExclusively(name: string, ttlMs: number, job: () => Promise<unknown>) {
  const key = `job-lock:${name}`;
  const owner = randomUUID();
  let locked = false;
  if (redisReady()) {
    try {
      locked = (await redis.set(key, owner, { NX: true, PX: ttlMs })) === "OK";
      if (!locked) return; // another server is running this pass
    } catch (err: any) {
      logger.warn(`jobLock: Redis unavailable for "${name}", running locally: ${err?.message}`);
    }
  }
  try {
    await job();
  } finally {
    // Release only our own lock (it may have expired and been taken by another server)
    if (locked && redisReady()) {
      try { if ((await redis.get(key)) === owner) await redis.del(key); } catch { /* expires on its own */ }
    }
  }
}
