'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';
import { ORDER_STATUS_LABELS, autoOrderStatus } from '@/lib/order-status';

const TONES = {
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  cancelled: 'bg-stone-100 text-stone-600 ring-stone-500/20',
};

/**
 * Admin → Orders: the order's status as a dropdown (Pending / Completed / Cancelled, or back to Automatic).
 * Changes save straight away and show instantly; a failed save puts the old value back. Cancelling a paid order
 * asks first, because it stops the buyer's downloads.
 */
export default function OrderStatusSelect({ order }) {
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState({ status: order.status, statusSetBy: order.statusSetBy ?? 'auto' });
  const [saving, setSaving] = useState(false);
  const [, startRefresh] = useTransition();
  const orderNo = `#${order._id.slice(-8).toUpperCase()}`;
  const manual = current.statusSetBy === 'admin';

  async function change(value) {
    if (value === 'auto' ? !manual : value === current.status && manual) return;
    if (value === 'cancelled' && order.paymentStatus === 'paid' && !window.confirm(`Cancel ${orderNo}? The buyer will no longer be able to download these items. No money is refunded automatically.`)) {
      return;
    }
    const previous = current;
    // Instant feedback; reverted below if the save fails.
    setCurrent(value === 'auto' ? { status: autoOrderStatus(order), statusSetBy: 'auto' } : { status: value, statusSetBy: 'admin' });
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${order._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update the status.');
      setCurrent({ status: data.status, statusSetBy: data.statusSetBy });
      toast.success(`${orderNo} is ${ORDER_STATUS_LABELS[data.status].toLowerCase()}`, data.statusSetBy === 'auto' ? 'Status follows the payment again.' : undefined);
      startRefresh(() => router.refresh());
    } catch (err) {
      setCurrent(previous);
      toast.error('Status not changed', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex">
        <label htmlFor={`order-status-${order._id}`} className="sr-only">
          Status of order {orderNo}
        </label>
        <select
          id={`order-status-${order._id}`}
          value={current.status}
          disabled={saving}
          onChange={(e) => change(e.target.value)}
          className={`h-7 cursor-pointer appearance-none rounded-full pl-2.5 pr-7 text-xs font-medium ring-1 ring-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60 ${TONES[current.status]}`}
        >
          {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value} className="bg-white text-ink">
              {label}
            </option>
          ))}
          {manual && (
            <option value="auto" className="bg-white text-ink">
              ↺ Automatic ({ORDER_STATUS_LABELS[autoOrderStatus(order)]})
            </option>
          )}
        </select>
        <ChevronDown size={13} strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-70" />
      </span>
      <span
        title={manual ? 'Set by an admin — choose “Automatic” to follow the payment again' : 'Set automatically from the payment'}
        className="text-[11px] font-medium uppercase tracking-wide text-stone-400"
      >
        {manual ? 'Manual' : 'Auto'}
      </span>
    </span>
  );
}
