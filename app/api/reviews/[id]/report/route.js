import { getRequestUser } from '@/lib/auth';
import { errorResponse, forbidden, json, readJson, unauthorized } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { reportReview } from '@/lib/data/reviews';

/** POST /api/reviews/:id/report — { reason, message } — the seller of the product reports the review to Sellpify. */
export async function POST(request, { params }) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Only the shop that sold the product can report its reviews.');
  if (!rateLimit(`review-report:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }).ok) return json({ error: 'Too many reports in a short time.' }, 429);
  try {
    const { id } = await params;
    return json(await reportReview(user.id, id, await readJson(request, 4 * 1024)), 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/reviews/[id]/report');
  }
}
