'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';
import { formatPrice } from '@/lib/utils';

/**
 * "Mark as Paid": confirm in a native <dialog>, optionally record the bank/wallet transaction ID,
 * then POST /api/admin/payouts. The server clears the balance atomically and writes the ledger entry.
 */
export default function ClearPayoutButton({ sellerId, storeName, amount }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const router = useRouter();
  const toast = useToast();
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function confirm() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the exact amount shown (and paid): newer sales stay pending rather than being marked paid.
        body: JSON.stringify({ sellerId, amount, reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not clear payout');
      dialogRef.current?.close();
      toast.success(`Paid ${formatPrice(data.amount)} to ${storeName}`, data.reference ? `Reference ${data.reference}` : undefined);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error('Payout not recorded', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="btn btn-sm btn-dark"
      >
        <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" />
        Mark as Paid
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(e) => e.target === e.currentTarget && !saving && e.currentTarget.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 text-ink shadow-2xl backdrop:bg-black/40"
      >
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-medium">
            Clear {formatPrice(amount)} for {storeName}?
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Only confirm after you’ve sent exactly {formatPrice(amount)}. That amount moves from their pending balance to their paid total; any newer sales stay pending.
          </p>
          <label htmlFor={`${titleId}-ref`} className="mt-5 block text-sm font-medium">
            Transaction reference <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <input
            id={`${titleId}-ref`}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={120}
            placeholder="Bank / wallet transaction ID"
            className="mt-1.5 h-11 w-full rounded-xl border border-stone-300 px-3.5 text-sm focus:border-black focus:outline-none"
          />
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={saving} className="h-10 rounded-full px-4 text-sm font-medium hover:bg-stone-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={saving}
              className="btn btn-md btn-dark"
            >
              {saving ? 'Recording…' : 'Confirm payout'}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
