import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { isRateLimited, rateLimit } from '@/lib/rate-limit';
import { REAUTH_LIMIT, deleteUserAccount, verifyAdminPassword } from '@/lib/data/admin-users';

/**
 * DELETE /api/admin/users/:id — { password } — permanently deletes a customer or seller account.
 * Strictly a signed-in admin session (same-origin enforced; the Bearer API key is NOT accepted) that re-enters
 * its own password. Returns { role, productsDeleted, productsUnpublished, ordersUnlinked }.
 */
export async function DELETE(request, { params }) {
  const admin = await getRequestUser(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'admin') return forbidden('Admin access required.');
  const throttleKey = `admin-reauth:${admin.id}`;
  if (isRateLimited(throttleKey, REAUTH_LIMIT)) return json({ error: 'Too many wrong passwords. Please wait a few minutes.' }, 429);

  try {
    const { id } = await params;
    const body = await readJson(request);
    try {
      await verifyAdminPassword(admin.id, body.password);
    } catch (err) {
      if (err.status === 403) rateLimit(throttleKey, REAUTH_LIMIT); // count the failure
      throw err;
    }
    return json(await deleteUserAccount(id, { actingAdminId: admin.id }));
  } catch (err) {
    return errorResponse(err, 'DELETE /api/admin/users/[id]');
  }
}
