'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';

/** Seller → My products row actions: hide/show (approved products) and delete with a Yes/No confirmation. */
export default function SellerProductActions({ product }) {
  const { _id: id, title, status, isPublished } = product;
  const router = useRouter();
  const toast = useToast();
  const dialogRef = useRef(null);
  const titleId = useId();
  const [busy, setBusy] = useState(null); // 'visibility' | 'delete'
  const [refreshing, startTransition] = useTransition();

  async function call(method, body) {
    const res = await fetch(`/api/seller/products/${id}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }

  async function toggleVisibility() {
    setBusy('visibility');
    try {
      await call('PATCH', { isPublished: !isPublished });
      toast.success(isPublished ? `“${title}” is hidden from the store` : `“${title}” is live again`);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error('Could not update the product', err.message);
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    setBusy('delete');
    try {
      const data = await call('DELETE');
      dialogRef.current?.close();
      if (data.result === 'archived') {
        toast.info(`“${title}” was unpublished`, 'It has already been bought, so it stays available to those buyers but is hidden from the store.');
      } else {
        toast.success(`“${title}” deleted`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error('Could not delete the product', err.message);
    } finally {
      setBusy(null);
    }
  }

  const pending = Boolean(busy) || refreshing;
  return (
    <div className="flex items-center justify-end gap-1">
      {status === 'approved' && (
        <button
          type="button"
          onClick={toggleVisibility}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-60"
        >
          {isPublished ? <EyeOff size={15} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={15} strokeWidth={1.75} aria-hidden="true" />}
          {busy === 'visibility' ? 'Saving…' : isPublished ? 'Hide' : 'Show'}
          <span className="sr-only"> {title}</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        disabled={pending}
        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
      >
        <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
        Delete
        <span className="sr-only"> {title}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(e) => e.target === e.currentTarget && busy !== 'delete' && e.currentTarget.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
      >
        <div className="p-6">
          <span className="grid size-11 place-items-center rounded-full bg-red-50 text-red-600">
            <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 id={titleId} className="mt-4 text-lg font-medium">
            Are you sure you want to delete?
          </h2>
          <p className="mt-1 text-sm font-medium text-stone-800">{title}</p>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            The product is removed from your shop permanently. If someone has already bought it, it’s hidden from the store
            instead, so those buyers keep their downloads.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={busy === 'delete'} className="btn btn-md text-stone-700 hover:bg-stone-100">
              No, cancel
            </button>
            <button type="button" onClick={confirmDelete} disabled={busy === 'delete'} className="btn btn-md bg-red-600 text-white hover:bg-red-700">
              {busy === 'delete' && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {busy === 'delete' ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
