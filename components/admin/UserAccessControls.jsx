'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, ChevronDown, ShieldCheck, UserCheck } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';

const ROLE_LABELS = { customer: 'Customer', seller: 'Seller', admin: 'Admin' };
const ROLE_STYLES = {
  customer: 'border-stone-200 bg-stone-50 text-stone-700',
  seller: 'border-brand-100 bg-brand-50 text-brand-700',
  admin: 'border-ink bg-ink text-white',
};
const dialogCls = 'm-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-3xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40';

async function patchUser(id, body) {
  const res = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { fields: data.fields });
  return data;
}

/** What changing from `from` to `to` will do, in plain words (shown in the confirmation). */
function consequences(from, to) {
  const lines = ['They are signed out on every device and pick up the new role when they sign in again.'];
  if (to === 'admin') lines.unshift('They get full access to this admin console — products, orders, payouts and every account.');
  if (from === 'admin') lines.unshift('They lose access to the admin console.');
  if (to === 'seller' && from !== 'seller') lines.push('They’ll be asked to set up their shop the next time they open the seller dashboard.');
  if (from === 'seller' && to === 'customer') lines.push('Their live listings are hidden from the store. Sales history and earnings are kept.');
  return lines;
}

/**
 * Role dropdown for one user row. Changing it opens a confirmation; granting or revoking admin access also asks for
 * your password (the API enforces this). `locked` = your own account or the owner: shown, not editable.
 */
export function RoleSelect({ user, locked }) {
  const router = useRouter();
  const toast = useToast();
  const dialogRef = useRef(null);
  const titleId = useId();
  const passwordId = useId();
  const [next, setNext] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const needsPassword = next && (next === 'admin' || user.role === 'admin');

  if (locked) {
    return (
      <span className={`inline-flex rounded-full border px-3 py-0.5 text-xs font-medium ${ROLE_STYLES[user.role]}`}>{ROLE_LABELS[user.role]}</span>
    );
  }

  function choose(role) {
    if (role === user.role) return;
    setNext(role);
    setPassword('');
    setError('');
    dialogRef.current?.showModal();
  }

  async function confirm(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await patchUser(user.id, { role: next, ...(needsPassword && { password }) });
      dialogRef.current?.close();
      toast.success(`${user.name} is now ${next === 'admin' ? 'an admin' : `a ${ROLE_LABELS[next].toLowerCase()}`}`);
      startRefresh(() => router.refresh());
    } catch (err) {
      setError(err.fields?.password || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="relative z-10 inline-flex">
        <label htmlFor={`role-${user.id}`} className="sr-only">
          Role for {user.name}
        </label>
        <select
          id={`role-${user.id}`}
          value={user.role}
          disabled={saving || refreshing}
          onChange={(e) => choose(e.target.value)}
          className={`h-7 cursor-pointer appearance-none rounded-full border pl-3 pr-7 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60 ${ROLE_STYLES[user.role]}`}
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value} className="bg-white text-ink">
              {label}
            </option>
          ))}
        </select>
        <ChevronDown size={13} strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-70" />
      </div>

      <dialog ref={dialogRef} aria-labelledby={titleId} onClick={(e) => e.target === e.currentTarget && !saving && e.currentTarget.close()} className={dialogCls}>
        <form onSubmit={confirm}>
          <div className="p-6 sm:p-7">
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-700">
              <ShieldCheck size={20} strokeWidth={1.9} />
            </span>
            <h2 id={titleId} className="mt-5 text-lg font-semibold tracking-tight">
              Make {user.name} {next === 'admin' ? 'an admin' : `a ${ROLE_LABELS[next]?.toLowerCase() ?? ''}`}?
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {ROLE_LABELS[user.role]} → {ROLE_LABELS[next]}
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-600 marker:text-stone-400">
              {next && consequences(user.role, next).map((line) => <li key={line}>{line}</li>)}
            </ul>
            {needsPassword && (
              <div className="mt-5">
                <label htmlFor={passwordId} className="text-sm font-medium">
                  Your password
                </label>
                <input
                  id={passwordId}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-300 px-4 text-sm focus:border-black focus:outline-none"
                />
                <p className="mt-2 text-xs text-stone-500">Required to grant or remove admin access.</p>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-stone-100 bg-stone-50/60 px-6 py-4 sm:flex sm:justify-end sm:px-7">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={saving} className="h-10 rounded-full border border-stone-300 bg-white px-5 text-sm font-medium hover:border-ink disabled:opacity-60">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-md btn-primary h-10 disabled:opacity-70">
              {saving ? 'Saving…' : 'Change role'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/**
 * Block / Unblock for one user row (shown before Delete). Blocking asks for confirmation: the user is signed out,
 * can't sign in, and a seller's live listings are hidden — nothing is deleted. Unblocking restores all of it.
 */
export function BlockUserButton({ user, labelClassName = '' }) {
  const router = useRouter();
  const toast = useToast();
  const dialogRef = useRef(null);
  const titleId = useId();
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const blocked = Boolean(user.blockedAt);
  const busy = saving || refreshing;

  async function run(nextBlocked) {
    setSaving(true);
    try {
      const data = await patchUser(user.id, { blocked: nextBlocked });
      dialogRef.current?.close();
      const listings = data.listings ? ` ${data.listings} listing${data.listings === 1 ? '' : 's'} ${nextBlocked ? 'hidden' : 'back in the store'}.` : '';
      toast.success(nextBlocked ? `${user.name} is blocked` : `${user.name} is unblocked`, listings.trim() || undefined);
      startRefresh(() => router.refresh());
    } catch (err) {
      toast.error(nextBlocked ? 'Could not block this account' : 'Could not unblock this account', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => (blocked ? run(false) : dialogRef.current?.showModal())}
        title={`${blocked ? 'Unblock' : 'Block'} ${user.name}`}
        className={`relative z-10 inline-flex h-8 items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors disabled:opacity-60 ${
          labelClassName ? 'w-8 2xl:w-auto 2xl:px-3' : 'px-3'
        } ${
          blocked ? 'text-emerald-700 hover:bg-emerald-50' : 'text-stone-700 hover:bg-stone-100'
        }`}
      >
        {blocked ? <UserCheck size={15} strokeWidth={1.75} aria-hidden="true" /> : <Ban size={15} strokeWidth={1.75} aria-hidden="true" />}
        <span className={labelClassName}>{busy ? (blocked ? 'Unblocking…' : 'Blocking…') : blocked ? 'Unblock' : 'Block'}</span>
        <span className="sr-only">
          {labelClassName && (blocked ? 'Unblock' : 'Block')} {user.name}
        </span>
      </button>

      <dialog ref={dialogRef} aria-labelledby={titleId} onClick={(e) => e.target === e.currentTarget && !saving && e.currentTarget.close()} className={dialogCls}>
        <div className="p-6 sm:p-7">
          <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-amber-50 text-amber-700">
            <Ban size={20} strokeWidth={1.9} />
          </span>
          <h2 id={titleId} className="mt-5 text-lg font-semibold tracking-tight">
            Block {user.name}?
          </h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-600 marker:text-stone-400">
            <li>They’re signed out everywhere and can’t sign in until you unblock them.</li>
            {user.role === 'seller' && <li>Their live listings are hidden from the store.</li>}
            <li>Nothing is deleted — orders, earnings and listings are kept, and Unblock restores everything.</li>
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-stone-100 bg-stone-50/60 px-6 py-4 sm:flex sm:justify-end sm:px-7">
          <button type="button" onClick={() => dialogRef.current?.close()} disabled={saving} className="h-10 rounded-full border border-stone-300 bg-white px-5 text-sm font-medium hover:border-ink disabled:opacity-60">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => run(true)}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center rounded-full bg-amber-600 px-5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-70"
          >
            {saving ? 'Blocking…' : 'Block account'}
          </button>
        </div>
      </dialog>
    </>
  );
}
