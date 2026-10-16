import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, errorResponse } from '@/lib/api';
import { deleteUserAccount } from '@/lib/data/admin-users';

/**
 * DELETE /api/admin/users/:id — permanently deletes a customer or seller account.
 * Strictly a signed-in admin session (same-origin enforced); the Bearer API key is NOT accepted here.
 * Returns { role, productsDeleted, productsUnpublished, ordersUnlinked }.
 */
export async function DELETE(request, { params }) {
  const admin = await getRequestUser(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'admin') return forbidden('Admin access required.');

  try {
    const { id } = await params;
    return json(await deleteUserAccount(id, { actingAdminId: admin.id }));
  } catch (err) {
    return errorResponse(err, 'DELETE /api/admin/users/[id]');
  }
}
