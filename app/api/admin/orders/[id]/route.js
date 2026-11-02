import { revalidatePath } from 'next/cache';
import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { setOrderStatus } from '@/lib/data/admin';

/**
 * PATCH /api/admin/orders/:id — { status: 'pending' | 'completed' | 'cancelled' | 'auto' }. Signed-in admin session
 * only (same-origin). 'auto' hands the status back to the payment-based default (lib/order-status.js).
 */
export async function PATCH(request, { params }) {
  const admin = await getRequestUser(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'admin') return forbidden('Admin access required.');
  try {
    const { id } = await params;
    const { status } = await readJson(request);
    const result = await setOrderStatus(id, status);
    revalidatePath('/admin'); // dashboard totals and recent orders
    return json(result);
  } catch (err) {
    return errorResponse(err, 'PATCH /api/admin/orders/[id]');
  }
}
