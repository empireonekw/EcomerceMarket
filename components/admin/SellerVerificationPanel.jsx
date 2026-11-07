'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';
import { countryOf, CURRENCIES } from '@/lib/seller-onboarding';

const STATUS = {
  pending: { label: 'Waiting for review', cls: 'bg-amber-50 text-amber-800' },
  verified: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-800' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700' },
};
const day = (d) => (d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '–');

/**
 * Admin → user → "Verification": what a seller entered when opening their shop (preferences, address, phone) and the
 * identity check they sent after their first sale (ID front and back, live selfie; from the admin-only route), with
 * Verify / Reject. Rejecting needs a reason, which the seller is messaged.
 */
export default function SellerVerificationPanel({ userId, shop }) {
  const router = useRouter();
  const toast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const v = shop.verification;
  const status = STATUS[v?.status] ?? STATUS.pending;

  async function decide(next) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verification`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.fields?.note ?? body.error ?? 'Could not save.');
      toast.success(next === 'verified' ? 'Seller verified' : 'Verification rejected');
      setRejecting(false);
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const a = shop.address;
  const rows = [
    ['Country', countryOf(shop.preferences?.country)?.name ?? '–'],
    ['Currency', CURRENCIES.find((c) => c.value === shop.preferences?.currency)?.label ?? '–'],
    ['Address', a ? [a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(', ') : '–'],
    ['Phone', shop.phone ? `${shop.phone.dial} ${shop.phone.number}` : '–'],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-4">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.cls}`}>{status.label}</span>
        <span className="text-xs text-stone-500">
          Submitted {day(v?.submittedAt)}
          {v?.reviewedAt && ` · reviewed ${day(v.reviewedAt)}`}
        </span>
      </div>
      {v?.status === 'rejected' && v.note && <p className="border-b border-stone-100 px-5 py-3 text-sm text-red-700">Reason: {v.note}</p>}

      <dl className="divide-y divide-stone-100 text-sm">
        {rows.map(([k, val]) => (
          <div key={k} className="flex justify-between gap-4 px-5 py-3">
            <dt className="shrink-0 text-stone-500">{k}</dt>
            <dd className="text-right font-medium break-words">{val}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-2 gap-3 border-t border-stone-100 p-5 sm:grid-cols-3">
        {[
          ['front', 'ID front'],
          ['back', 'ID back'],
          ['selfie', 'Live selfie'],
        ].map(([side, label]) => {
          const doc = v?.[side];
          const href = `/api/admin/users/${userId}/id-document/${side}`;
          return (
            <div key={side} className={side === 'selfie' ? 'col-span-2 sm:col-span-1' : ''}>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
              {!doc ? (
                <p className="mt-2 text-sm text-stone-400">{side === 'selfie' && v ? 'None (sent before selfies were asked)' : 'Not sent yet'}</p>
              ) : doc.pdf ? (
                <a href={href} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-xl border border-stone-200 p-3 text-sm hover:border-ink">
                  <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
                  Open PDF
                </a>
              ) : (
                <a href={href} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-stone-200 hover:border-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={href} alt={label} className="aspect-[4/3] w-full bg-stone-50 object-contain" />
                </a>
              )}
            </div>
          );
        })}
      </div>
      {v && <p className="px-5 pb-4 text-xs text-stone-500">Check the selfie matches the photo on the ID card, and the name matches the shop’s billing details.</p>}

      {v && (
        <div className="border-t border-stone-100 p-5">
          {rejecting ? (
            <div>
              <label htmlFor="reject-note" className="text-sm font-medium">
                Why is it rejected?
              </label>
              <textarea
                id="reject-note"
                rows={2}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. The photo of the back is blurry. Please upload a clearer one."
                className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-ink focus:outline-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => decide('rejected')}
                  className="btn btn-sm bg-red-600 text-white hover:bg-red-700"
                >
                  Reject
                </button>
                <button type="button" disabled={saving} onClick={() => setRejecting(false)} className="btn btn-sm btn-outline">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {v.status !== 'verified' && (
                <button type="button" disabled={saving} onClick={() => decide('verified')} className="btn btn-sm btn-dark">
                  Mark as verified
                </button>
              )}
              {v.status !== 'rejected' && (
                <button type="button" disabled={saving} onClick={() => setRejecting(true)} className="btn btn-sm btn-outline">
                  Reject…
                </button>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
