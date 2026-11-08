import 'server-only';
import { NextResponse } from 'next/server';
import { InputError } from '@/lib/data/product-writes';
import { rateLimit } from '@/lib/rate-limit';

// Shared Route Handler plumbing: JSON parsing, consistent error responses.

export const NO_STORE = { 'Cache-Control': 'no-store' };

export const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export const unauthorized = (message = 'Please log in.') => json({ error: message }, 401);
export const forbidden = (message = 'You don’t have access to this.') => json({ error: message }, 403);

/**
 * Per-account (or per-IP) limit for one route, on top of the site-wide ones in proxy.js: a 429 response once `key` has
 * been used more than `limit` times in `windowMs`, else null. Use: const slow = tooMany(key, 30, 600_000); if (slow) return slow;
 */
export function tooMany(key, limit, windowMs, message = 'Too many requests in a short time. Please wait a few minutes and try again.') {
  const result = rateLimit(key, { limit, windowMs });
  if (result.ok) return null;
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { ...NO_STORE, 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) } },
  );
}

/** Parses a JSON object body with a size cap. Throws InputError (→ 4xx) on bad input. */
export async function readJson(request, maxBytes = 32 * 1024) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new InputError('Content-Type must be application/json', {}, 415);
  }
  const raw = await request.text();
  if (raw.length > maxBytes) throw new InputError('Payload too large', {}, 413);
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new InputError('Invalid JSON body');
  }
}

/** Maps known errors to their status; logs and hides everything else. */
export function errorResponse(err, label) {
  if (err instanceof InputError) return json({ error: err.message, fields: err.fields }, err.status);
  console.error(`[${label}]`, err);
  return json({ error: 'Something went wrong. Please try again.' }, 500);
}
