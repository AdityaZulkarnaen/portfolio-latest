import "server-only";

/**
 * A fixed-window counter, in memory.
 *
 * **Know what this is before relying on it.** The state lives in one process:
 * it resets on every deploy and every cold start, and a platform running two
 * instances gives an attacker two windows instead of one. That is a real
 * weakness and it is the honest trade — the alternative is a Redis or KV
 * dependency, and for a portfolio's contact form the cost of that outweighs
 * what it buys. Moving to Upstash or Vercel KV later means rewriting this file
 * and nothing else; `check()` is the whole surface.
 *
 * What it does buy is the thing that actually matters here: a single client
 * cannot hold the form open and pour messages through it, and the process
 * cannot be made to grow without bound while it tries.
 */

type Window = {
  count: number;
  /** Epoch ms at which this window is spent and the key can start over. */
  resetAt: number;
};

/**
 * Hard ceiling on tracked keys.
 *
 * Without it the map *is* the attack: rotate the address on every request and
 * the process grows one entry per request until it dies. At the ceiling the
 * window closest to expiring is dropped, which costs that client its history
 * rather than costing everyone the service — refusing new keys instead would
 * mean an attacker could lock out every visitor by filling the table.
 */
const MAX_KEYS = 5000;

const windows = new Map<string, Window>();

/** Drops what has expired. Cheap, and only ever runs on the way to the cap. */
function prune(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

function evictOldest() {
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [key, window] of windows) {
    if (window.resetAt < oldestAt) {
      oldestAt = window.resetAt;
      oldestKey = key;
    }
  }
  if (oldestKey !== null) windows.delete(oldestKey);
}

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until this key is allowed again. 0 when it already is. */
  retryAfter: number;
};

/**
 * Counts one hit against `key` and says whether it is allowed.
 *
 * Fixed window rather than a sliding one on purpose: a sliding window needs a
 * timestamp per hit, which is a list per key, which is the unbounded-growth
 * problem again in a smaller box. The cost is that a client can spend one full
 * window at the very end of it and another at the start of the next — twice the
 * limit across a couple of seconds. For "three messages in ten minutes" that
 * ceiling is six, and six is still not a flood.
 */
export function check(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      prune(now);
      if (windows.size >= MAX_KEYS) evictOldest();
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { ok: true, retryAfter: 0 };
}
