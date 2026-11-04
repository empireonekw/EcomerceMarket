import { getRequestUser } from '@/lib/auth';
import { errorResponse, forbidden, json, readJson, unauthorized } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { submitVerification } from '@/lib/data/seller-verification';

/** POST /api/seller/verification { idFront, idBack, selfie } → the seller's identity check (lib/data/seller-verification.js). */
export async function POST(request) {
  const user = await getRequestUser(request); // same-origin enforced for writes
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');
  if (!rateLimit(`verification:${user.id}`, { limit: 10, windowMs: 60 * 60_000 }).ok) {
    return json({ error: 'Too many attempts in a short time. Please try again later.' }, 429);
  }
  try {
    return json(await submitVerification(user.id, await readJson(request, 4 * 1024)), 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/verification');
  }
}
