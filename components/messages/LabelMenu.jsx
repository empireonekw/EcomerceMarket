'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MESSAGE_LIMITS } from '@/lib/validation';

/** Click-outside + Escape closing for the inbox's small dropdowns. */
export function useDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, rootRef };
}

const initialStates = (labels, selected) =>
  Object.fromEntries(
    labels.map((l) => {
      const n = selected.filter((c) => c.labels.includes(l)).length;
      return [l, n === 0 ? 'none' : n === selected.length ? 'all' : 'some'];
    }),
  );

/**
 * "Label ▾": tick labels on/off for the selected conversations, or create a new one. Changes apply on Done.
 * `onApply({ add, remove })` — names to add to / remove from the selection (a new label is in `add`).
 */
export default function LabelMenu({ labels, selected, onApply, compact = false }) {
  const { open, setOpen, rootRef } = useDropdown();
  const [states, setStates] = useState({});
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();

  function toggleOpen() {
    if (!open) {
      setStates(initialStates(labels, selected));
      setDraft('');
      setError('');
    }
    setOpen(!open);
  }

  const start = initialStates(labels, selected);
  const add = labels.filter((l) => states[l] === 'all' && start[l] !== 'all');
  const remove = labels.filter((l) => states[l] === 'none' && start[l] !== 'none');
  const newLabel = draft.trim();
  const dirty = add.length > 0 || remove.length > 0 || newLabel.length > 0;

  async function done() {
    if (!dirty) return setOpen(false);
    if (newLabel && labels.some((l) => l.toLowerCase() === newLabel.toLowerCase()) && !add.includes(newLabel)) {
      add.push(labels.find((l) => l.toLowerCase() === newLabel.toLowerCase()));
    } else if (newLabel) {
      add.push(newLabel);
    }
    setBusy(true);
    const result = await onApply({ add: [...new Set(add)], remove });
    setBusy(false);
    if (result?.error) setError(result.error);
    else setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex items-center gap-1 rounded-full px-3 py-2 text-[15px] font-semibold text-ink transition-colors hover:bg-stone-200/60 ${compact ? 'px-2' : ''}`}
      >
        Label
        <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
      </button>

      {open && (
        <div role="dialog" aria-label="Label conversations" className="absolute right-0 top-0 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white p-5 shadow-lift sm:-right-3 sm:-top-3 2xl:-left-6 2xl:right-auto">
          <p className="flex items-center gap-1 text-[15px] font-semibold">
            Label <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
          </p>

          {labels.length > 0 ? (
            <ul className="mt-4 max-h-56 space-y-1 overflow-y-auto">
              {labels.map((l) => (
                <li key={l}>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-[15px] hover:bg-stone-50 ${selected.length ? '' : 'cursor-not-allowed opacity-50'}`}>
                    <input
                      type="checkbox"
                      disabled={!selected.length}
                      checked={states[l] === 'all'}
                      ref={(el) => el && (el.indeterminate = states[l] === 'some')}
                      onChange={(e) => setStates((s) => ({ ...s, [l]: e.target.checked ? 'all' : 'none' }))}
                      className="size-5 rounded border-stone-400 accent-black"
                    />
                    <span className="truncate">{l}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <div className="h-10" />
          )}

          <label htmlFor={inputId} className="sr-only">
            Create new label
          </label>
          <input
            id={inputId}
            value={draft}
            maxLength={MESSAGE_LIMITS.label}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), done())}
            placeholder="Create new label"
            className="mt-4 h-12 w-full rounded-lg border border-stone-400 px-4 text-[15px] outline-none placeholder:text-stone-500 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/40"
          />
          {!selected.length && newLabel && <p className="mt-2 text-xs text-stone-500">The label is created; select conversations to apply it.</p>}
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={done}
            disabled={busy}
            className={`mt-4 h-12 w-full rounded-full text-base font-semibold text-white transition-colors ${dirty ? 'bg-black hover:bg-stone-800' : 'bg-stone-400'}`}
          >
            {busy ? 'Saving…' : 'Done'}
          </button>
        </div>
      )}
    </div>
  );
}
