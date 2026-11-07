'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';
import { formatPrice } from '@/lib/utils';

/**
 * Admin → Orders & Sales: delete an order (test purchases) after a confirmation. The server undoes its sale: seller
 * earnings, sales counts and its reviews (DELETE /api/admin/orders/:id).
 */
export default function DeleteOrderButton({ order }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const router = useRouter();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = deleting || refreshing;
  const ref = `#${order._id.slice(-8).toUpperCase()}`;

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/orders/${order._id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      dialogRef.current?.close();
      toast.success(`Order ${ref} deleted`, data.salesUndone ? 'Its sales were taken off the sellers’ totals.' : undefined);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error('Could not delete the order', err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        disabled={busy}
        aria-label={`Delete order ${ref}`}
        title="Delete order"
        className="grid size-8 place-items-center rounded-full text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
      >
        {busy ? (
          <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
        ) : (
          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(e) => e.target === e.currentTarget && !deleting && e.currentTarget.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-3xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
      >
        <div className="p-6 sm:p-7">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-red-50 text-red-600 ring-8 ring-red-50/50">
            <Trash2 size={20} strokeWidth={1.9} />
          </span>
          <h2 id={titleId} className="mt-5 text-lg font-semibold tracking-tight">
            Delete order {ref} permanently?
          </h2>
          <p className="mt-3 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-800 ring-1 ring-stone-200/70">
            <span className="block truncate font-medium">{order.buyerEmail}</span>
            <span className="block truncate text-stone-600">
              {order.items.map((i) => i.title).join(', ')} · {formatPrice(order.totalAmount, order.currency)}
            </span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            For test orders. Its sales are <strong className="font-medium text-ink">taken off the sellers’ earnings and sales counts</strong>, any
            reviews written from it are removed, and the buyer loses access to its downloads. This can’t be undone. It doesn’t refund any money.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-stone-100 bg-stone-50/60 px-6 py-4 sm:flex sm:justify-end sm:px-7">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={deleting}
            className="h-10 rounded-full border border-stone-300 bg-white px-5 text-sm font-medium hover:border-ink disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
          >
            {deleting && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {deleting ? 'Deleting…' : 'Delete order'}
          </button>
        </div>
      </dialog>
    </>
  );
}
