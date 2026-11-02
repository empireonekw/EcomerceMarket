import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { isRateLimited, rateLimit } from '@/lib/rate-limit';
import { refreshStorefront } from '@/lib/revalidate';
import { REAUTH_LIMIT, changeUserRole, deleteUserAccount, roleChangeNeedsPassword, setUserBlocked, verifyAdminPassword } from '@/lib/data/admin-users';

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

/**
 * PATCH /api/admin/users/:id — { role: 'customer' | 'seller' | 'admin', password? } or { blocked: boolean }.
 * Signed-in admin session only (same-origin; no API key). Granting or revoking admin access also needs the acting
 * admin's password. You can't change your own account or the owner account.
 */
export async function PATCH(request, { params }) {
  const admin = await getRequestUser(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'admin') return forbidden('Admin access required.');

  try {
    const { id } = await params;
    const body = await readJson(request);

    if (typeof body.blocked === 'boolean') {
      const result = await setUserBlocked(id, body.blocked, { actingAdminId: admin.id });
      if (result.listings) refreshStorefront();
      return json(result);
    }

    if (typeof body.role === 'string') {
      if (await roleChangeNeedsPassword(id, body.role)) {
        const throttleKey = `admin-reauth:${admin.id}`;
        if (isRateLimited(throttleKey, REAUTH_LIMIT)) return json({ error: 'Too many wrong passwords. Please wait a few minutes.' }, 429);
        try {
          await verifyAdminPassword(admin.id, body.password);
        } catch (err) {
          if (err.status === 403) rateLimit(throttleKey, REAUTH_LIMIT);
          throw err;
        }
      }
      const result = await changeUserRole(id, body.role, { actingAdminId: admin.id });
      if (result.listingsHidden) refreshStorefront();
      return json(result);
    }

    return json({ error: 'Send { role } or { blocked }.' }, 400);
  } catch (err) {
    return errorResponse(err, 'PATCH /api/admin/users/[id]');
  }
}
