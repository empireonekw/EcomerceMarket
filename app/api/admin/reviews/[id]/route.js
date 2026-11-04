import { getRequestUser } from '@/lib/auth';
import { errorResponse, forbidden, json, readJson, unauthorized } from '@/lib/api';
import { moderateReview } from '@/lib/data/reviews';

/**
 * PATCH /api/admin/reviews/:id — { action: 'keep' | 'edit' | 'remove' | 'restore', rating?, body?, reason?, note? }
 * Resolves a reported review (lib/data/reviews.js moderateReview). Admin session only.
 */
export async function PATCH(request, { params }) {
  const admin = await getRequestUser(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'admin') return forbidden('Admin access required.');
  try {
    const { id } = await params;
    return json(await moderateReview(id, await readJson(request, 8 * 1024)));
  } catch (err) {
    return errorResponse(err, 'PATCH /api/admin/reviews/[id]');
  }
}
