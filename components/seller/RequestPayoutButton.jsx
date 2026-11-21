'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';
import { buttonClasses } from '@/components/dashboard/ui';
import { formatPrice } from '@/lib/utils';

/** Asks the admin team to pay out the pending balance. Disabled while a request is open. */
export default function RequestPayoutButton({ disabled, reason }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  async function request() {
    setPending(true);
    try {
      const res = await fetch('/api/seller/payouts', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      toast.success(
        'Payout requested',
        data.fee > 0
          ? `Our team will send ${formatPrice(data.netAmount, 'USD')} (after the ${formatPrice(data.fee, 'USD')} merchant fee) to your saved bank or wallet details.`
          : 'Our team will send it to your saved bank or wallet details.',
      );
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error('Could not request payout', err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={request} disabled={disabled || pending} className={buttonClasses.primary}>
        <Send size={16} strokeWidth={1.75} aria-hidden="true" />
        {pending ? 'Requesting…' : 'Request payout'}
      </button>
      {disabled && reason && <p className="text-xs text-stone-500">{reason}</p>}
    </div>
  );
}
