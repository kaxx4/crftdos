import { supabaseAdmin } from "@/lib/supabase/server";

// Shared, cross-instance rate limiting backed by stall_rate_limits.
//
// This was a per-process `Map`. On Vercel every serverless instance carried
// its own copy, so PRD §12's "5 failed PIN attempts per IP per 15 minutes" was
// effectively unenforced in production: an attacker who tripped the limit was
// simply routed to a cold instance with a fresh counter. The check-and-count
// now happens in one atomic statement in Postgres.

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type HitRow = { allowed: boolean; remaining: number; retry_after_seconds: number };

async function hit(key: string, countIt: boolean): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin().rpc("stall_rate_limit_hit", {
    p_key: key,
    p_max: MAX_ATTEMPTS,
    p_window_seconds: WINDOW_SECONDS,
    p_count_it: countIt,
  });

  // Fail CLOSED. If the limiter is unreachable we cannot tell a first attempt
  // from a thousandth, and this gate protects the admin PIN — refusing a
  // legitimate volunteer for a moment is the cheaper mistake.
  if (error) {
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  }

  const row = (Array.isArray(data) ? data[0] : data) as HitRow | undefined;
  if (!row) return { allowed: false, remaining: 0, retryAfterSeconds: 60 };

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.retry_after_seconds,
  };
}

/** Read the current state without consuming an attempt. */
export function checkRateLimit(key: string): Promise<RateLimitResult> {
  return hit(key, false);
}

/** Record a failed attempt against the key. */
export async function recordFailure(key: string): Promise<void> {
  await hit(key, true);
}

/** Clear the counter after a successful authentication. */
export async function clearRateLimit(key: string): Promise<void> {
  await supabaseAdmin()
    .rpc("stall_rate_limit_clear", { p_key: key })
    .then(() => undefined);
}

/** Derive the limiter key from the request. Exported so every PIN-checking
 *  route keys the same way rather than each inventing its own. */
export function rateLimitKey(req: Request, scope: string): string {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return `${ip}:${scope}`;
}
