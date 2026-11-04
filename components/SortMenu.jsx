'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from '@/components/PrefetchLink';
import { Check, ChevronDown } from 'lucide-react';

/**
 * "Sort by: Newest ▾" dropdown for product lists. `options` = [{ key, label, href }], `current` = the active key.
 * Each option is a plain link (works without JS, keeps the URL shareable). Closes on outside click and Escape.
 */
export default function SortMenu({ options, current }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const id = useId();
  const active = options.find((o) => o.key === current) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && (setOpen(false), ref.current?.querySelector('button')?.focus());
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/80 bg-white pr-3.5 pl-4 text-sm transition-colors hover:bg-stone-50"
      >
        <span className="text-stone-600">Sort by:</span>
        <span className="font-semibold text-ink">{active.label}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul id={id} className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white py-1.5 shadow-xl">
          {options.map((o) => (
            <li key={o.key}>
              <Link
                href={o.href}
                onClick={() => setOpen(false)}
                aria-current={o.key === active.key ? 'true' : undefined}
                className={`flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-stone-50 ${o.key === active.key ? 'font-semibold text-ink' : 'text-stone-700'}`}
              >
                {o.label}
                {o.key === active.key && <Check size={16} strokeWidth={2} aria-hidden="true" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
