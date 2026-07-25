import "server-only";

/**
 * In-memory login rate limiter. This is a single-instance, single-admin app
 * (no serverless/multi-instance deployment expected), so an in-memory map
 * is sufficient and avoids pulling in Redis for one login form. If this
 * app is ever deployed across multiple instances, swap this for a shared
 * store (e.g. Upstash Redis) behind the same `checkRateLimit` signature.
 */

interface Bucket {
  count: number;
  firstAttemptAt: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs: number;
}

/** Call once per login attempt, keyed by client IP (or IP+username). */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.firstAttemptAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAttemptAt: now });
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: WINDOW_MS - (now - bucket.firstAttemptAt),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - bucket.count,
    retryAfterMs: 0,
  };
}

/** Call after a successful login to clear the failure count for this key. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

// Periodically sweep expired buckets so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.firstAttemptAt > WINDOW_MS) buckets.delete(key);
  }
}, WINDOW_MS).unref?.();
