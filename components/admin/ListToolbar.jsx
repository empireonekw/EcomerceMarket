'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { usePendingNav } from '@/components/dashboard/PendingNav';

// The admin list toolbar (Users, and any list that wants it): segmented tabs, search and dropdown filters, all in one
// card. Navigation goes through <PendingNavProvider>, so the list shows its skeleton while the new page loads.

/** Segmented control of links: [{ key, label, count, href }]. */
export function SegmentedNav({ label, items, activeKey }) {
  const { target, navigate } = usePendingNav();
  const active = target ? (items.find((i) => i.href === target)?.key ?? activeKey) : activeKey;
  return (
    <nav aria-label={label} className="flex max-w-full overflow-x-auto rounded-xl bg-stone-100 p-1 [scrollbar-width:none]">
      {items.map((item) => {
        const on = item.key === active;
        return (
          <a
            key={item.key}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              if (!on) navigate(item.href);
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              on ? 'bg-white text-ink shadow-[0_1px_2px_rgba(16,16,16,0.08)]' : 'text-stone-500 hover:text-ink'
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={`text-xs tabular-nums ${on ? 'text-stone-500' : 'text-stone-400'}`}>{item.count.toLocaleString('en-US')}</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

/** Search box: submits as a GET (?q=) keeping `params`. */
export function SearchBox({ action, params = {}, defaultValue = '', placeholder }) {
  const { navigate } = usePendingNav();
  const id = useId();
  return (
    <form
      action={action}
      role="search"
      className="relative w-full sm:w-72"
      onSubmit={(e) => {
        e.preventDefault();
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
        const q = new FormData(e.currentTarget).get('q')?.toString().trim();
        if (q) qs.set('q', q);
        const s = qs.toString();
        navigate(s ? `${action}?${s}` : action);
      }}
    >
      <label htmlFor={id} className="sr-only">
        Search
      </label>
      <Search
        size={16}
        strokeWidth={1.75}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400"
      />
      {Object.entries(params).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <input
        id={id}
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-stone-200 bg-white pr-3 pl-9 text-sm placeholder:text-stone-400 focus:border-ink focus:outline-none"
      />
    </form>
  );
}

/**
 * A filter as a small dropdown button ("ID check: To review ▾"). options: [{ key, label, count?, href }].
 * `range`: optional custom date range at the bottom: { from, to, max, action, params } (params = the filters to keep).
 */
export function FilterMenu({ label, options, activeKey, range }) {
  const { navigate } = usePendingNav();
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const box = useRef(null);
  const current = options.find((o) => o.key === activeKey) ?? (activeKey === 'range' ? { label: 'Custom range' } : options[0]);
  const isSet = activeKey && activeKey !== options[0]?.key;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => (document.removeEventListener('pointerdown', close), document.removeEventListener('keydown', esc));
  }, [open]);

  const go = (href) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          setAlignRight(e.currentTarget.getBoundingClientRect().left + 256 > window.innerWidth - 8);
          setOpen((v) => !v);
        }}
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors ${
          isSet ? 'border-ink bg-ink text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
        }`}
      >
        <span className={isSet ? 'text-white/70' : 'text-stone-500'}>{label}:</span>
        <span className="font-medium">{current?.label}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className={isSet ? 'text-white/70' : 'text-stone-400'} />
      </button>
      {open && (
        <div
          className={`absolute ${alignRight ? 'right-0' : 'left-0'} z-30 mt-2 w-64 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_24px_50px_-20px_rgba(16,16,16,0.25)]`}
        >
          <ul aria-label={label}>
            {options.map((o) => (
              <li key={o.key || 'all'}>
                <button
                  type="button"
                  onClick={() => go(o.href)}
                  aria-current={o.key === activeKey || undefined}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-50"
                >
                  <span className={o.key === activeKey ? 'font-semibold text-ink' : 'text-stone-700'}>{o.label}</span>
                  <span className="flex items-center gap-2">
                    {o.count !== undefined && <span className="text-xs text-stone-400 tabular-nums">{o.count.toLocaleString('en-US')}</span>}
                    {o.key === activeKey && <Check size={15} strokeWidth={2.5} aria-hidden="true" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {range && (
            <form
              className="mt-1.5 border-t border-stone-100 px-3 pt-3 pb-2"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                let [from, to] = [d.get('from') || '', d.get('to') || ''];
                if (from && to && from > to) [from, to] = [to, from];
                if (!from && !to) return;
                const qs = new URLSearchParams();
                for (const [k, v] of Object.entries({ ...range.params, from, to })) if (v) qs.set(k, v);
                go(`${range.action}?${qs}`);
              }}
            >
              <p className="text-xs font-medium text-stone-500">Custom range</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs text-stone-500">
                  From
                  <input
                    name="from"
                    type="date"
                    defaultValue={range.from}
                    max={range.max}
                    className="mt-1 h-9 w-full rounded-lg border border-stone-300 px-2 text-sm text-ink focus:border-ink focus:outline-none"
                  />
                </label>
                <label className="text-xs text-stone-500">
                  To
                  <input
                    name="to"
                    type="date"
                    defaultValue={range.to}
                    max={range.max}
                    className="mt-1 h-9 w-full rounded-lg border border-stone-300 px-2 text-sm text-ink focus:border-ink focus:outline-none"
                  />
                </label>
              </div>
              <button type="submit" className="btn btn-sm btn-dark mt-3 w-full">
                Apply
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/** "Clear filters" link. */
export function ClearFilters({ href }) {
  const { navigate } = usePendingNav();
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        navigate(href);
      }}
      className="inline-flex h-9 items-center gap-1 rounded-xl px-2.5 text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-ink"
    >
      <X size={14} strokeWidth={2} aria-hidden="true" />
      Clear filters
    </a>
  );
}
