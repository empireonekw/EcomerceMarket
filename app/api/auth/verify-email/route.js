import { getRequestUser } from '@/lib/auth';
import { errorResponse, json, readJson, unauthorized } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { confirmVerificationCode, sendVerificationCode } from '@/lib/data/email-verification';

/**
 * Email verification for the signed-in account (lib/data/email-verification.js):
 *   POST → emails a 6-digit code → { sent, resendIn } (429 with fields.resendIn while the last one is under a minute old)
 *   PUT  { code } → { verified: true }
 */
export async function POST(request) {
  const user = await getRequestUser(request); // same-origin enforced for writes
  if (!user) return unauthorized();
  if (!rateLimit(`verify-email:send:${user.id}`, { limit: 6, windowMs: 60 * 60_000 }).ok) {
    return json({ error: 'Too many codes sent. Please try again in an hour.' }, 429);
  }
  try {
    return json(await sendVerificationCode(user.id));
  } catch (err) {
    return errorResponse(err, 'POST /api/auth/verify-email');
  }
}

export async function PUT(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (!rateLimit(`verify-email:check:${user.id}`, { limit: 20, windowMs: 10 * 60_000 }).ok) {
    return json({ error: 'Too many tries. Please wait a few minutes.' }, 429);
  }
  try {
    const { code } = await readJson(request, 1024);
    return json(await confirmVerificationCode(user.id, code));
  } catch (err) {
    return errorResponse(err, 'PUT /api/auth/verify-email');
  }
}
