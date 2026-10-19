import 'server-only';

/**
 * Minimal fixed-window rate limiter (in-memory, per server instance).
 * Good enough for a single Node server / dev. On serverless or multiple instances,
 * swap the Map for a shared store (e.g. Redis/Upstash) with the same interface.
 */
const buckets = globalThis.__rateLimitBuckets ?? new Map();
globalThis.__rateLimitBuckets = buckets;

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    return { ok: true, remaining: limit - 1 };
  }
  bucket.count += 1;
  return { ok: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), retryAfterMs: bucket.resetAt - now };
}

/** Checks a key WITHOUT counting a hit — for limits that should only count failures (see admin re-auth). */
export function isRateLimited(key, { limit }) {
  const bucket = buckets.get(key);
  return Boolean(bucket && bucket.resetAt > Date.now() && bucket.count >= limit);
}

export function clientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
}
