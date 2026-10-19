import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { isRateLimited, rateLimit } from '@/lib/rate-limit';
import { REAUTH_LIMIT, deleteUserAccounts, verifyAdminPassword } from '@/lib/data/admin-users';

/**
 * POST /api/admin/users/bulk-delete — { ids: string[] (≤100), password } — deletes several accounts.
 * Admin session + the admin's password. Accounts that can't be deleted are skipped with a reason.
 * Returns { deleted: [{ id, name, role, … }], skipped: [{ id, name, reason }] }.
 */
export async function POST(request) {
  const admin = await getRequestUser(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'admin') return forbidden('Admin access required.');
  const throttleKey = `admin-reauth:${admin.id}`;
  if (isRateLimited(throttleKey, REAUTH_LIMIT)) return json({ error: 'Too many wrong passwords. Please wait a few minutes.' }, 429);

  try {
    const body = await readJson(request);
    try {
      await verifyAdminPassword(admin.id, body.password);
    } catch (err) {
      if (err.status === 403) rateLimit(throttleKey, REAUTH_LIMIT); // count the failure
      throw err;
    }
    return json(await deleteUserAccounts(body.ids, { actingAdminId: admin.id }));
  } catch (err) {
    return errorResponse(err, 'POST /api/admin/users/bulk-delete');
  }
}
