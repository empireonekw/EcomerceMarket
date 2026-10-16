import { revalidatePath } from 'next/cache';
import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { createReview } from '@/lib/data/reviews';

/** POST /api/reviews — { productId, rating (1–5), body } from a signed-in customer who bought the product. */
export async function POST(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized('Please log in to write a review.');
  if (user.role !== 'customer') return forbidden('Only customer accounts can write reviews.');
  if (!rateLimit(`review:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }).ok) {
    return json({ error: 'Too many reviews in a short time. Please try again later.' }, 429);
  }

  try {
    const body = await readJson(request);
    const review = await createReview(user.id, { productId: body.productId, rating: body.rating, body: body.body });
    revalidatePath('/'); // the homepage Reviews section is statically cached (ISR)
    return json(review, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/reviews');
  }
}
