import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { clearSellerPayout } from '@/lib/data/payouts';

/**
 * POST /api/admin/payouts — { sellerId, amount?, reference? } records a manual payout.
 * `amount` (cents) = what was actually sent; only that much is cleared. Omit it to clear the full balance.
 * Admin session or Bearer ADMIN_API_KEY.
 */
export async function POST(request) {
  const auth = await authorizeAdminRequest(request);
  if (!auth) return unauthorized('Admin access required.');

  try {
    const { sellerId, amount, reference } = await readJson(request);
    const payout = await clearSellerPayout({ sellerId, amount, reference, adminId: auth.admin?.id });
    return json(payout);
  } catch (err) {
    return errorResponse(err, 'POST /api/admin/payouts');
  }
}
