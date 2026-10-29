'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Trash2 } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';
import { FieldError, inputClass } from '@/components/auth/AuthFields';

const PREVIEW = 5;

function consequences(users) {
  const sellers = users.some((u) => u.role === 'seller');
  return sellers
    ? 'Accounts are removed permanently. Sellers’ unsold products are deleted; products buyers already purchased are unpublished so those buyers keep their downloads. Past orders stay in your records.'
    : 'Accounts and their sign-in are removed permanently. Past orders stay in your records.';
}

/**
 * "Are you sure you want to delete?" — one dialog for a single account or a bulk selection.
 * Requires the admin's own password (checked server-side) before anything is deleted.
 * `users`: [{ id, name, role }]. `onDeleted(ids)` lets the table clear its selection.
 */
export default function DeleteUsersDialog({ users, open, onClose, onDeleted, redirectTo }) {
  const dialogRef = useRef(null);
  const passwordRef = useRef(null);
  const id = useId();
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const single = users.length === 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setPassword('');
      setError(null);
      dialog.showModal();
      passwordRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function onConfirm(e) {
    e.preventDefault();
    if (!password) return setError('Enter your password to confirm.');
    setPending(true);
    setError(null);
    try {
      const res = single
        ? await fetch(`/api/admin/users/${users[0].id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
        : await fetch('/api/admin/users/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: users.map((u) => u.id), password }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fields?.password || res.status === 429) {
          setError(data.fields?.password ?? data.error);
          passwordRef.current?.select();
        } else {
          toast.error('Could not delete', data.error ?? 'Please try again.');
          onClose();
        }
        return;
      }

      const deleted = single ? [{ id: users[0].id, name: users[0].name }] : data.deleted;
      const skipped = single ? [] : data.skipped;
      if (deleted.length) toast.success(single ? `${users[0].name} was deleted` : `${deleted.length} account${deleted.length === 1 ? '' : 's'} deleted`);
      if (skipped.length) toast.info(`${skipped.length} skipped`, skipped.map((s) => `${s.name}: ${s.reason}`).join(' · '));
      onDeleted?.(deleted.map((d) => d.id));
      onClose();
      startTransition(() => {
        if (redirectTo && deleted.length) router.push(redirectTo);
        router.refresh();
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const sellers = users.filter((u) => u.role === 'seller').length;
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      onClose={onClose} // Escape
      onClick={(e) => e.target === e.currentTarget && !pending && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
    >
      <form onSubmit={onConfirm} className="p-6">
        <span className="grid size-11 place-items-center rounded-full bg-red-50 text-red-600">
          <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 id={`${id}-title`} className="mt-4 text-lg font-medium">
          Are you sure you want to delete?
        </h2>

        {single ? (
          <p className="mt-1 text-sm text-stone-700">
            <span className="font-medium">{users[0].name}</span> · {users[0].role === 'seller' ? 'Seller' : 'Customer'}
          </p>
        ) : (
          <div className="mt-2 rounded-xl bg-stone-50 px-4 py-3 text-sm">
            <p className="font-medium">
              {users.length} accounts
              <span className="font-normal text-stone-500">
                {' '}
                · {sellers} seller{sellers === 1 ? '' : 's'}, {users.length - sellers} customer{users.length - sellers === 1 ? '' : 's'}
              </span>
            </p>
            <p className="mt-1 text-stone-600">
              {users
                .slice(0, PREVIEW)
                .map((u) => u.name)
                .join(', ')}
              {users.length > PREVIEW && ` and ${users.length - PREVIEW} more`}
            </p>
          </div>
        )}

        <p className="mt-3 text-sm leading-relaxed text-stone-600">{consequences(users)}</p>
        <p className="mt-2 text-sm font-medium text-red-700">This can’t be undone.</p>

        <div className="mt-5">
          <label htmlFor={`${id}-password`} className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
            <Lock size={14} strokeWidth={1.75} aria-hidden="true" />
            Enter your admin password to confirm
          </label>
          <input
            ref={passwordRef}
            id={`${id}-password`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${id}-password-error` : undefined}
            className={inputClass(error)}
          />
          <FieldError id={`${id}-password-error`}>{error}</FieldError>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="btn btn-md text-stone-700 hover:bg-stone-100">
            No, cancel
          </button>
          <button type="submit" disabled={pending} className="btn btn-md bg-red-600 text-white hover:bg-red-700">
            {pending && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {pending ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
