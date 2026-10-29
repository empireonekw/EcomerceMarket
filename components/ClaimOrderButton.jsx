'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Receipt page: link a guest order to the signed-in account (the receipt token proves ownership). */
export default function ClaimOrderButton({ orderId, token }) {
  const router = useRouter();
  const [state, setState] = useState({ status: 'idle', message: null });

  async function claim() {
    setState({ status: 'pending', message: null });
    try {
      const res = await fetch('/api/orders/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ status: 'error', message: data.error || 'Could not save this order.' });
      setState({ status: 'done', message: data.message });
      router.refresh();
    } catch {
      setState({ status: 'error', message: 'Network error. Please try again.' });
    }
  }

  if (state.status === 'done') {
    return (
      <p role="status" className="text-sm text-emerald-700">
        {state.message}{' '}
        <Link href="/profile?tab=downloads" className="font-medium underline">
          View my purchases
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={claim}
        disabled={state.status === 'pending'}
        className="btn btn-md btn-primary"
      >
        {state.status === 'pending' && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
        Save to my account
      </button>
      {state.message && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </div>
  );
}
