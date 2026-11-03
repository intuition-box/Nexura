import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { redis } from "@/config/redis";
import logger from "@/config/logger";

/**
 * Brute-force protection for sign-in and one-time-code endpoints.
 *
 * - 5 wrong attempts for one email from one IP locks that pair for 15 minutes.
 * - 15 wrong attempts for one email from any mix of IPs locks the email for 30 minutes,
 *   so a distributed guess can't just rotate addresses. The higher bar means one attacker
 *   on one IP can't lock the real person out from their own network.
 * - Every IP is also capped on how many auth requests it can make at all (authIpLimiter).
 *
 * Counters live in Redis when it's up (shared across servers), otherwise in memory.
 */
const PAIR_LIMIT = 5;
const PAIR_LOCK_MS = 15 * 60 * 1000;
const EMAIL_LIMIT = 15;
const EMAIL_LOCK_MS = 30 * 60 * 1000;

// ─── Counter store: Redis, with an in-memory fallback ───────────────────────
const memory = new Map<string, { count: number; expiresAt: number }>();

const redisReady = () => { try { return redis.isReady; } catch { return false; } };

async function getCount(key: string): Promise<{ count: number; ttlMs: number }> {
  if (redisReady()) {
    try {
      const [raw, ttl] = await Promise.all([redis.get(key), redis.pTTL(key)]);
      return { count: Number(raw ?? 0), ttlMs: Math.max(0, Number(ttl)) };
    } catch (err: any) { logger.warn(`authGuard: Redis read failed, using memory: ${err?.message}`); }
  }
  const row = memory.get(key);
  if (!row || row.expiresAt <= Date.now()) { memory.delete(key); return { count: 0, ttlMs: 0 }; }
  return { count: row.count, ttlMs: row.expiresAt - Date.now() };
}

/** Adds one failure; the window starts at the first failure and isn't extended by later ones. */
async function increment(key: string, windowMs: number): Promise<number> {
  if (redisReady()) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.pExpire(key, windowMs);
      return count;
    } catch (err: any) { logger.warn(`authGuard: Redis write failed, using memory: ${err?.message}`); }
  }
  const now = Date.now();
  const row = memory.get(key);
  if (!row || row.expiresAt <= now) { memory.set(key, { count: 1, expiresAt: now + windowMs }); return 1; }
  row.count += 1;
  return row.count;
}

async function clear(key: string) {
  memory.delete(key);
  if (redisReady()) { try { await redis.del(key); } catch { /* expires on its own */ } }
}

/** Stretches the key's expiry to `ms` once it reaches its limit (the lockout period). */
async function lockFor(key: string, ms: number) {
  if (redisReady()) { try { await redis.pExpire(key, ms); return; } catch { /* fall through */ } }
  const row = memory.get(key);
  if (row) row.expiresAt = Date.now() + ms;
}

// Keep the in-memory fallback from growing without bound
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memory) if (v.expiresAt <= now) memory.delete(k);
}, 10 * 60 * 1000).unref?.();

const clientIp = (req: Request) => String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60000));

/**
 * Locks out repeated failures on one endpoint family (`scope`, e.g. "hub-login").
 * A response of 400/401/404 counts as a wrong attempt; any 2xx clears the counters.
 * `field` is the body field holding the email.
 */
export const attemptGuard = (scope: string, field = "email") =>
  async (req: Request, res: Response, next: NextFunction) => {
    const email = String((req.body ?? {})[field] ?? "").trim().toLowerCase();
    if (!email) { next(); return; }

    const pairKey = `auth-fail:${scope}:${email}:${clientIp(req)}`;
    const emailKey = `auth-fail:${scope}:${email}`;

    try {
      const [pair, all] = await Promise.all([getCount(pairKey), getCount(emailKey)]);
      const blockedMs = pair.count >= PAIR_LIMIT ? pair.ttlMs : all.count >= EMAIL_LIMIT ? all.ttlMs : 0;
      if (blockedMs > 0) {
        res.setHeader("Retry-After", String(Math.ceil(blockedMs / 1000)));
        res.status(429).json({
          error: `Too many incorrect attempts. Try again in ${minutes(blockedMs)} minute${minutes(blockedMs) === 1 ? "" : "s"}, or reset your password.`,
        });
        return;
      }
    } catch (err: any) {
      logger.warn(`authGuard: check failed, allowing the request: ${err?.message}`);
    }

    res.on("finish", () => {
      const status = res.statusCode;
      if (status >= 200 && status < 300) {
        void clear(pairKey);
        void clear(emailKey);
      } else if (status === 400 || status === 401 || status === 404) {
        void (async () => {
          const pairCount = await increment(pairKey, PAIR_LOCK_MS);
          const emailCount = await increment(emailKey, EMAIL_LOCK_MS);
          if (pairCount >= PAIR_LIMIT) await lockFor(pairKey, PAIR_LOCK_MS);
          if (emailCount >= EMAIL_LIMIT) await lockFor(emailKey, EMAIL_LOCK_MS);
        })().catch(err => logger.warn(`authGuard: could not record a failure: ${err?.message}`));
      }
    });
    next();
  };

/** Caps how many sign-in / code requests one IP can make, whatever the email. */
export const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  // The app sets "trust proxy"; the per-email lockout above is what stops spoofed-IP guessing
  validate: { trustProxy: false },
  message: { error: "Too many sign-in attempts from this network. Try again in 15 minutes." },
});

/** Caps how often codes can be emailed from one IP (forgot password, email checks). */
export const codeSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // The app sets "trust proxy"; the per-email lockout above is what stops spoofed-IP guessing
  validate: { trustProxy: false },
  message: { error: "Too many codes requested. Try again in 15 minutes." },
});
