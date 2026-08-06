// In-memory rate limiter: 5 failed PIN attempts per IP per 15 minutes.
// This is per-process (fine for a single-instance small deploy / dev; a
// serverless multi-instance prod deploy would need a shared store like
// Supabase or Redis — flagged as a known limitation, not built now).

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 0, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
  return { allowed: b.count < MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - b.count) };
}

export function recordFailure(key: string) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    b.count += 1;
  }
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}
