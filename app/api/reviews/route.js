import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { createReview, getProductReviews } from '@/lib/data/reviews';

/** GET /api/reviews?product=<id>&page=2&rating=5 — a product's public reviews, newest first (product page). */
export async function GET(request) {
  const sp = request.nextUrl.searchParams;
  const rating = Number(sp.get('rating'));
  try {
    return json(await getProductReviews(sp.get('product'), { page: sp.get('page'), rating: Number.isInteger(rating) && rating > 0 ? rating : undefined }));
  } catch (err) {
    return errorResponse(err, 'GET /api/reviews');
  }
}

/** POST /api/reviews — { productId, rating (1–5), body } from a signed-in buyer of the product (not its seller). */
export async function POST(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized('Please log in to write a review.');
  if (user.role === 'admin') return forbidden('Admin accounts can’t write reviews.');
  if (!rateLimit(`review:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }).ok) {
    return json({ error: 'Too many reviews in a short time. Please try again later.' }, 429);
  }

  try {
    const body = await readJson(request);
    const review = await createReview(user.id, { productId: body.productId, rating: body.rating, body: body.body });
    return json(review, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/reviews');
  }
}
