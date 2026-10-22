'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';

/** Admin → Messages: "Mark resolved" / "Reopen" via PATCH /api/admin/messages/:id. */
export default function MessageStatusButton({ id, status }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const next = status === 'resolved' ? 'new' : 'resolved';

  async function update() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update the message');
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error('Message not updated', err.message);
    } finally {
      setSaving(false);
    }
  }

  const Icon = next === 'resolved' ? CheckCircle2 : RotateCcw;
  return (
    <button type="button" onClick={update} disabled={saving} className={`btn btn-sm ${next === 'resolved' ? 'btn-dark' : 'btn-outline'}`}>
      <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
      {next === 'resolved' ? 'Mark resolved' : 'Reopen'}
    </button>
  );
}
