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
export default function ClearPayoutButton({ sellerId, storeName, amount, fee = 0, net = amount }) {
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
        // Send the exact balance shown: newer sales stay pending rather than being marked paid. The server takes the
        // same merchant fee from it (lib/commission.js payoutFee), so what the admin sent matches the record.
        body: JSON.stringify({ sellerId, amount, reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not clear payout');
      dialogRef.current?.close();
      toast.success(
        `Paid ${formatPrice(data.netAmount ?? data.amount)} to ${storeName}`,
        [data.fee > 0 && `${formatPrice(data.fee)} merchant fee kept`, data.reference && `Reference ${data.reference}`].filter(Boolean).join(' · ') || undefined,
      );
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
            Send {formatPrice(net)} to {storeName}?
          </h2>
          <dl className="mt-3 space-y-1 rounded-xl bg-stone-50 px-4 py-3 text-sm tabular-nums">
            <div className="flex justify-between text-stone-600">
              <dt>Pending balance</dt>
              <dd>{formatPrice(amount)}</dd>
            </div>
            <div className="flex justify-between text-stone-600">
              <dt>Merchant fee</dt>
              <dd>−{formatPrice(fee)}</dd>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-1 font-medium text-ink">
              <dt>Send to seller</dt>
              <dd>{formatPrice(net)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-stone-600">
            Only confirm after you’ve sent exactly {formatPrice(net)}. Their {formatPrice(amount)} balance is cleared and the fee is kept; any newer
            sales stay pending.
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
            className="mt-2 h-11 w-full rounded-xl border border-stone-300 px-4 text-sm focus:border-black focus:outline-none"
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
