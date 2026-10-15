'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';

/** Approve / reject a seller-submitted product (PUT /api/products/:id { status }). */
export default function ModerationActions({ id, title }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [, startTransition] = useTransition();

  async function decide(status) {
    setBusy(status);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Update failed');
      toast.success(status === 'approved' ? `“${title}” approved and live` : `“${title}” rejected`);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error('Could not update product', err.message);
    } finally {
      setBusy(null);
    }
  }

  const base = 'inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-60';
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => decide('approved')} disabled={Boolean(busy)} className={`${base} bg-black text-white hover:bg-stone-800`}>
        <Check size={14} strokeWidth={2} aria-hidden="true" />
        {busy === 'approved' ? 'Approving…' : 'Approve'}
      </button>
      <button type="button" onClick={() => decide('rejected')} disabled={Boolean(busy)} className={`${base} text-red-600 hover:bg-red-50`}>
        <X size={14} strokeWidth={2} aria-hidden="true" />
        {busy === 'rejected' ? 'Rejecting…' : 'Reject'}
      </button>
    </div>
  );
}
