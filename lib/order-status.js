// Order fulfilment status, shared by the Order model, the admin orders API and the admin table (client-safe).

export const ORDER_STATUS_LABELS = { pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled' };

/**
 * The status an order gets automatically from its payment:
 *   free (nothing to pay) or paid (card, demo/test payment) → completed
 *   failed or refunded                                     → cancelled
 *   anything else (unpaid, processing)                     → pending
 * Admins can override it (Order.statusSetBy = 'admin').
 */
export function autoOrderStatus({ paymentStatus, paymentProvider, totalAmount } = {}) {
  if (paymentStatus === 'failed' || paymentStatus === 'refunded') return 'cancelled';
  if (paymentStatus === 'paid' || paymentProvider === 'free' || totalAmount === 0) return 'completed';
  return 'pending';
}
