import { getRequestUser } from '@/lib/auth';
import { errorResponse, forbidden, json, readJson, unauthorized } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { getOnboarding, saveOnboardingStep, submitOnboarding } from '@/lib/data/seller-onboarding';

/**
 * The shop-opening wizard (/sell-on-sellpify, lib/data/seller-onboarding.js), for the signed-in account:
 *   GET  → { step, data } saved progress
 *   PUT  { step, data } → saves one step (after checking it) → { step, data }
 *   POST { agreeTerms: true } → opens the shop → { storeName }
 * Saving and opening need a verified email (lib/data/email-verification.js).
 */
const UNVERIFIED = 'Please verify your email first (Account settings).';
export async function GET(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  try {
    return json(await getOnboarding(user.id));
  } catch (err) {
    return errorResponse(err, 'GET /api/seller/onboarding');
  }
}

export async function PUT(request) {
  const user = await getRequestUser(request); // same-origin enforced for writes
  if (!user) return unauthorized();
  if (!user.emailVerified) return forbidden(UNVERIFIED);
  if (!rateLimit(`onboarding:${user.id}`, { limit: 60, windowMs: 10 * 60_000 }).ok) {
    return json({ error: 'Too many saves in a short time. Please wait a minute.' }, 429);
  }
  try {
    const body = await readJson(request, 16 * 1024);
    return json(await saveOnboardingStep(user.id, body?.step, body?.data));
  } catch (err) {
    return errorResponse(err, 'PUT /api/seller/onboarding');
  }
}

export async function POST(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (!user.emailVerified) return forbidden(UNVERIFIED);
  if (!rateLimit(`onboarding:${user.id}`, { limit: 60, windowMs: 10 * 60_000 }).ok) {
    return json({ error: 'Too many attempts in a short time. Please wait a minute.' }, 429);
  }
  try {
    return json(await submitOnboarding(user.id, await readJson(request, 4 * 1024)), 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/onboarding');
  }
}
