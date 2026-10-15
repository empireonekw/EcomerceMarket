import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, errorResponse } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { requestPayout } from '@/lib/data/seller';

/** POST /api/seller/payouts — request a payout of the current pending balance. */
export async function POST(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');
  if (!rateLimit(`payout-request:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }).ok) {
    return json({ error: 'Too many requests. Please try again later.' }, 429);
  }

  try {
    return json(await requestPayout(user.id), 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/payouts');
  }
}
