'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';

/** Delete with a native <dialog> confirmation; shows pending state until the table has refreshed. */
export default function DeleteProductButton({ id, title, redirectTo }) {
  const dialogRef = useRef(null);
  const titleId = useId(); // unique even when the same product renders twice (mobile cards + desktop table)
  const router = useRouter();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = deleting || refreshing;

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      dialogRef.current?.close();
      if (data.result === 'archived') {
        toast.info(`“${title}” was unpublished`, `It has ${data.orderCount} order(s), so it was hidden instead of deleted. Buyers keep their downloads.`);
      } else {
        toast.success(`“${title}” deleted`);
      }
      startTransition(() => {
        // From the edit page, a deleted product has nothing left to show — go back to the list.
        if (redirectTo && data.result === 'deleted') router.push(redirectTo);
        router.refresh();
      });
    } catch (err) {
      toast.error('Could not delete product', err.message);
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
        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        {busy && <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />}
        {busy ? 'Deleting…' : 'Delete'}
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
          <h2 id={titleId} className="mt-5 text-lg font-semibold tracking-[-0.01em]">
            Delete this product?
          </h2>
          <p className="mt-3 truncate rounded-xl bg-stone-50 px-3.5 py-2.5 text-sm font-medium text-stone-800 ring-1 ring-stone-200/70" title={title}>
            {title}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            It will be removed from the store for good. If someone has already bought it, it is{' '}
            <strong className="font-medium text-ink">unpublished instead</strong>, so buyers keep their downloads.
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
            {deleting ? 'Deleting…' : 'Delete product'}
          </button>
        </div>
      </dialog>
    </>
  );
}
