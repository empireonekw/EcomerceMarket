'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';

const CONSEQUENCES = {
  seller:
    'Their account and shop are removed permanently. Unsold products are deleted; products buyers already purchased are unpublished, so those buyers keep their downloads.',
  customer: 'Their account and sign-in are removed permanently. Past orders stay in your records.',
};

/**
 * Admin → Users: delete a customer or seller after a native <dialog> confirmation.
 * `redirectTo` = where to go afterwards (the detail page has nothing left to show).
 */
export default function DeleteUserButton({ id, name, role, redirectTo, size = 'sm' }) {
  const dialogRef = useRef(null);
  const titleId = useId(); // unique when the same user renders twice (mobile card + desktop row)
  const router = useRouter();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const busy = deleting || refreshing;
  const noun = role === 'seller' ? 'seller' : 'user';

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      dialogRef.current?.close();
      const detail =
        role === 'seller' ? `${data.productsDeleted} product(s) deleted · ${data.productsUnpublished} unpublished for existing buyers` : undefined;
      toast.success(`${name} was deleted`, detail);
      startTransition(() => {
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      });
    } catch (err) {
      toast.error(`Could not delete ${noun}`, err.message);
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
        className={`relative z-10 inline-flex items-center gap-1.5 rounded-full font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 ${
          size === 'md' ? 'h-10 border border-red-200 px-4 text-sm' : 'h-8 px-3 text-sm'
        }`}
      >
        {busy ? (
          <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
        ) : (
          <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
        )}
        {busy ? 'Deleting…' : size === 'md' ? 'Delete account' : 'Delete'}
        {size !== 'md' && !busy && <span className="sr-only"> {name}</span>}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(e) => e.target === e.currentTarget && !deleting && e.currentTarget.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
      >
        <div className="p-6">
          <span className="grid size-11 place-items-center rounded-full bg-red-50 text-red-600">
            <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 id={titleId} className="mt-4 text-lg font-medium">
            Are you sure you want to delete this {noun}?
          </h2>
          <p className="mt-1 text-sm font-medium text-stone-800">{name}</p>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">{CONSEQUENCES[role] ?? CONSEQUENCES.customer}</p>
          <p className="mt-3 text-sm font-medium text-red-700">This can’t be undone.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={deleting} className="btn btn-md text-stone-700 hover:bg-stone-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="btn btn-md bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {deleting ? 'Deleting…' : `Delete ${noun}`}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
