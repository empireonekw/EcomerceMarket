'use client';

import { useOptimistic, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/dashboard/Toaster';

/** Published/Draft switch with an optimistic flip; rolls back automatically if the PUT fails. */
export default function PublishToggle({ id, title, isPublished }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [published, setOptimistic] = useOptimistic(isPublished);

  function toggle() {
    const next = !published;
    startTransition(async () => {
      setOptimistic(next);
      try {
        const res = await fetch(`/api/products/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPublished: next }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Update failed');
        toast.success(next ? `“${title}” is live` : `“${title}” moved to drafts`);
        router.refresh();
      } catch (err) {
        toast.error('Could not update status', err.message); // optimistic value reverts when the transition ends
      }
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={published}
      aria-label={`${published ? 'Unpublish' : 'Publish'} ${title}`}
      onClick={toggle}
      disabled={pending}
      className="group inline-flex items-center gap-2 disabled:cursor-wait"
    >
      <span className={`relative block h-5 w-9 shrink-0 rounded-full transition-colors ${published ? 'bg-emerald-500' : 'bg-stone-300'}`}>
        <span className={`absolute left-0 top-0.5 size-4 rounded-full bg-white shadow transition-transform ${published ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </span>
      <span className={`text-xs font-medium ${published ? 'text-emerald-700' : 'text-stone-500'}`}>
        {published ? 'Live' : 'Draft'}
      </span>
    </button>
  );
}
