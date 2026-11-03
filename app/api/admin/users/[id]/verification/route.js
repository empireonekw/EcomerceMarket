import { getRequestUser } from '@/lib/auth';
import { errorResponse, forbidden, json, readJson, unauthorized } from '@/lib/api';
import { setSellerVerification } from '@/lib/data/admin-users';

/**
 * PATCH /api/admin/users/:id/verification — { status: 'verified' | 'rejected', note? } — the result of checking the
 * ID a seller uploaded when opening their shop. Admin session only (same-origin; not the API key).
 */
export async function PATCH(request, { params }) {
  const admin = await getRequestUser(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'admin') return forbidden('Admin access required.');
  try {
    const { id } = await params;
    return json(await setSellerVerification(id, await readJson(request, 2 * 1024)));
  } catch (err) {
    return errorResponse(err, 'PATCH /api/admin/users/[id]/verification');
  }
}
