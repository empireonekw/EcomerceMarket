'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Zap } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';

const MODES = [
  { auto: true, label: 'Automatic', icon: Zap },
  { auto: false, label: 'Manual', icon: ShieldCheck },
];

/**
 * Admin → Products: "Listing approval". Automatic: seller listings and edits go live as soon as they're published.
 * Manual: they wait here for Approve / Reject (one by one or in bulk). Switching to Automatic while listings are
 * waiting asks whether to put those live too. Saved with PATCH /api/admin/settings.
 */
export default function ApprovalModeSwitch({ autoApprove, awaiting }) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false); // switching to Automatic with listings waiting

  async function save(auto, approvePending = false) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoApproveListings: auto, approvePending }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      toast.success(
        auto ? 'Automatic approval is on' : 'Manual approval is on',
        auto
          ? `New listings go live right away.${data.approved ? ` ${data.approved} waiting listing${data.approved === 1 ? ' is' : 's are'} live now too.` : ''}`
          : 'New and edited listings now wait here for your approval.',
      );
      setAsking(false);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error('Could not change listing approval', err.message);
    } finally {
      setSaving(false);
    }
  }

  function pick(auto) {
    if (auto === autoApprove || saving) return;
    if (auto && awaiting > 0) return setAsking(true);
    save(auto);
  }

  return (
    <section aria-labelledby="approval-heading" className="mb-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="approval-heading" className="flex items-center gap-2 font-medium text-ink">
            Listing approval
            {saving && <Loader2 size={14} className="animate-spin text-stone-400" aria-hidden="true" />}
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            {autoApprove
              ? 'Automatic: seller listings and edits go live as soon as they’re published. You can still hide or delete any listing.'
              : 'Manual: seller listings and edits wait below until you approve them, one by one or in bulk.'}
          </p>
        </div>
        <div role="radiogroup" aria-label="Listing approval" className="flex shrink-0 rounded-full border border-stone-200 bg-stone-50 p-1">
          {MODES.map(({ auto, label, icon: Icon }) => {
            const on = auto === autoApprove;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={saving}
                onClick={() => pick(auto)}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                  on ? 'bg-ink text-white shadow-sm' : 'text-stone-600 hover:text-ink'
                }`}
              >
                <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {asking && (
        <div role="alertdialog" aria-label="Listings waiting for review" className="mt-4 flex flex-col gap-3 rounded-xl bg-amber-50 p-4 text-sm sm:flex-row sm:items-center">
          <p className="flex-1 text-amber-900">
            {awaiting} listing{awaiting === 1 ? ' is' : 's are'} still waiting for review. Put {awaiting === 1 ? 'it' : 'them'} live too?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAsking(false)} disabled={saving} className="btn btn-sm text-stone-600 hover:bg-white">
              Cancel
            </button>
            <button type="button" onClick={() => save(true)} disabled={saving} className="btn btn-sm btn-outline bg-white">
              Just switch
            </button>
            <button type="button" onClick={() => save(true, true)} disabled={saving} className="btn btn-sm btn-dark">
              Switch and approve {awaiting}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
