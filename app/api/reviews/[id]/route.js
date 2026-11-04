import { getRequestUser } from '@/lib/auth';
import { errorResponse, json, readJson, unauthorized } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { updateOwnReview } from '@/lib/data/reviews';

/** PUT /api/reviews/:id — { rating, body } — the buyer edits their own review (at most 3 times). */
export async function PUT(request, { params }) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized('Please log in to edit your review.');
  if (!rateLimit(`review-edit:${user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 }).ok) return json({ error: 'Too many edits in a short time.' }, 429);
  try {
    const { id } = await params;
    const body = await readJson(request);
    return json(await updateOwnReview(user.id, id, { rating: body.rating, body: body.body }));
  } catch (err) {
    return errorResponse(err, 'PUT /api/reviews/[id]');
  }
}
