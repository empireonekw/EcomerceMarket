import { authorizeAdminRequest } from '@/lib/auth';
import { errorResponse, json, readJson, unauthorized } from '@/lib/api';
import { moderateProducts } from '@/lib/data/product-moderation';
import { refreshStorefront } from '@/lib/revalidate';

/**
 * POST /api/admin/products/moderate — admin. Approve or reject many seller listings at once (Admin → Products):
 *   { ids: [...], status: 'approved' | 'rejected' }   the selected ones
 *   { all: true, status: 'approved' }                 every listing awaiting review
 * → { updated, failed: [{ id, title, error }] }
 */
export async function POST(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const body = await readJson(request, 32 * 1024);
    const { updated, failed, slugs } = await moderateProducts({ ids: body.ids, all: body.all === true, status: body.status });
    if (updated) refreshStorefront(...slugs);
    return json({ updated, failed });
  } catch (err) {
    return errorResponse(err, 'POST /api/admin/products/moderate');
  }
}
