import { revalidatePath } from 'next/cache';
import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { setOrderStatus } from '@/lib/data/admin';
import { deleteOrder, OrderError } from '@/lib/data/orders';
import { refreshStorefront } from '@/lib/revalidate';

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

/**
 * DELETE /api/admin/orders/:id — permanently delete an order (test purchases), undoing its sale: ledger lines, seller
 * balances, product sales counts, its reviews (lib/data/orders.js deleteOrder). Admin session only (same-origin).
 */
export async function DELETE(request, { params }) {
  const admin = await getRequestUser(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'admin') return forbidden('Admin access required.');
  try {
    const { id } = await params;
    const result = await deleteOrder(id);
    revalidatePath('/admin'); // dashboard totals and recent orders
    refreshStorefront(); // product sales counts changed
    return json(result);
  } catch (err) {
    if (err instanceof OrderError) return json({ error: err.message }, err.status);
    return errorResponse(err, 'DELETE /api/admin/orders/[id]');
  }
}
