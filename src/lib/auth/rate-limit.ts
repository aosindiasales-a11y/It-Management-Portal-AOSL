import "server-only";

import { createHmac } from "crypto";

import { prisma } from "@/lib/prisma";

/**
 * Shared fixed-window rate limiter backed by the application database. The
 * upsert is one SQLite statement, so concurrent Vercel instances cannot lose
 * increments between a read and a write.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const CLEANUP_CHANCE = 1 / 64;

interface StoredBucket {
  attemptCount: number | bigint;
  expiresAt: Date | string | number | bigint;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs: number;
}

function hashKey(key: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for authentication rate limiting.");
  }

  return createHmac("sha256", secret)
    .update("it-manager-portal:rate-limit:v1\0")
    .update(key)
    .digest("hex");
}

function toTimestamp(value: StoredBucket["expiresAt"]): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    throw new Error("The rate-limit bucket returned an invalid expiration time.");
  }
  return timestamp;
}

async function cleanupExpiredBuckets(now: Date): Promise<void> {
  if (Math.random() >= CLEANUP_CHANCE) return;

  try {
    await prisma.rateLimitBucket.deleteMany({
      where: { expiresAt: { lte: now } },
    });
  } catch (error) {
    // Cleanup is best-effort and must not make an otherwise valid limiter
    // decision fail. The active key is reset by the upsert when it expires.
    console.warn("[rate-limit] Could not clean up expired buckets", error);
  }
}

/** Call once per login attempt, keyed by client IP (or IP+username). */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_MS);
  const keyHash = hashKey(key);

  const [bucket] = await prisma.$queryRaw<StoredBucket[]>`
    INSERT INTO "rate_limit_buckets" (
      "keyHash",
      "attemptCount",
      "windowStartedAt",
      "expiresAt"
    )
    VALUES (${keyHash}, 1, ${now}, ${expiresAt})
    ON CONFLICT ("keyHash") DO UPDATE SET
      "attemptCount" = CASE
        WHEN "expiresAt" <= ${now} THEN 1
        ELSE "attemptCount" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "expiresAt" <= ${now} THEN ${now}
        ELSE "windowStartedAt"
      END,
      "expiresAt" = CASE
        WHEN "expiresAt" <= ${now} THEN ${expiresAt}
        ELSE "expiresAt"
      END
    RETURNING "attemptCount", "expiresAt"
  `;

  if (!bucket) {
    throw new Error("The rate-limit bucket could not be created.");
  }

  await cleanupExpiredBuckets(now);

  const attemptCount = Number(bucket.attemptCount);
  const allowed = attemptCount <= MAX_ATTEMPTS;

  return {
    allowed,
    remainingAttempts: allowed ? Math.max(0, MAX_ATTEMPTS - attemptCount) : 0,
    retryAfterMs: allowed
      ? 0
      : Math.max(0, toTimestamp(bucket.expiresAt) - now.getTime()),
  };
}

/** Call after a successful login to clear the failure count for this key. */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({
    where: { keyHash: hashKey(key) },
  });
}
