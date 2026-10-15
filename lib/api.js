import 'server-only';
import { NextResponse } from 'next/server';
import { InputError } from '@/lib/data/product-writes';

// Shared Route Handler plumbing: JSON parsing, consistent error responses.

export const NO_STORE = { 'Cache-Control': 'no-store' };

export const json = (body, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export const unauthorized = (message = 'Please log in.') => json({ error: message }, 401);
export const forbidden = (message = 'You don’t have access to this.') => json({ error: message }, 403);

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
