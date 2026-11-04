import { getRequestUser } from '@/lib/auth';
import { json } from '@/lib/api';
import { getViewerReviewState } from '@/lib/data/reviews';

/** GET /api/reviews/mine?product=<id> — { canReview, ownProduct, review } for the signed-in visitor (product page). */
export async function GET(request) {
  const user = await getRequestUser(request);
  if (!user || user.role === 'admin') return json({ canReview: false, ownProduct: false, review: null, signedIn: Boolean(user) });
  return json({ ...(await getViewerReviewState(user.id, request.nextUrl.searchParams.get('product'))), signedIn: true });
}
