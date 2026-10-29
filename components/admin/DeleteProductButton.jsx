'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
      >
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-medium">
            Are you sure you want to delete?
          </h2>
          <p className="mt-1 text-sm font-medium text-stone-800">{title}</p>
          <p className="mt-2 text-sm text-stone-600">
            This permanently removes the product from the store. If it has already been purchased, it will be
            <strong> unpublished instead</strong> so existing buyers keep access to their downloads.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={deleting}
              className="h-10 rounded-full px-4 text-sm font-medium hover:bg-stone-100"
            >
              No, cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
            >
              {deleting && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
