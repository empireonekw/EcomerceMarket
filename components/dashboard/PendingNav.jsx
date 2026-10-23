'use client';

import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * Instant feedback for filter tabs and search on dashboard lists.
 *
 * Changing only the query string (?role=seller) keeps the old page on screen until the server answers, and
 * loading.jsx isn't shown for it. Inside <PendingNavProvider>, FilterTabs and PendingSearchForm navigate in a
 * transition instead: the tab pill moves on click, and <PendingContent> swaps its children for a skeleton until
 * the new data has arrived.
 */
const PendingNavContext = createContext({ pending: false, target: null, navigate: () => {} });

export function PendingNavProvider({ children }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState(null);

  const navigate = useCallback(
    (href) => {
      setTarget(href); // urgent: the tab moves in this frame
      startTransition(() => router.push(href, { scroll: false }));
    },
    [router],
  );

  return <PendingNavContext value={{ pending, target: pending ? target : null, navigate }}>{children}</PendingNavContext>;
}

export const usePendingNav = () => useContext(PendingNavContext);

/** Shows `fallback` while a navigation started by FilterTabs / PendingSearchForm is loading. */
export function PendingContent({ fallback, children }) {
  const { pending } = usePendingNav();
  return (
    <>
      {pending && fallback}
      {/* Hidden, not unmounted: selections etc. survive if the new data is identical. */}
      <div hidden={pending}>{children}</div>
    </>
  );
}

/**
 * Pill tabs with a sliding indicator. `items`: [{ key, label, count?, href }]; `activeKey` is the server's current
 * filter. The pill moves to a clicked tab immediately, before the server responds.
 */
export function FilterTabs({ label, items, activeKey }) {
  const { target, navigate } = usePendingNav();
  const pendingKey = target ? items.find((i) => i.href === target)?.key : undefined;
  const current = pendingKey ?? activeKey;

  const listRef = useRef(null);
  const tabRefs = useRef([]);
  const [pill, setPill] = useState(null); // { left, width, animate }

  useLayoutEffect(() => {
    const measure = (animate) => {
      const el = tabRefs.current[items.findIndex((i) => i.key === current)];
      if (!el) return;
      const left = el.offsetLeft;
      const width = el.offsetWidth;
      setPill((prev) => {
        if (prev && prev.left === left && prev.width === width) return prev; // unchanged: keep any running slide
        return { left, width, animate: animate ?? prev?.animate ?? false };
      });
    };
    measure(true); // first measure: `prev` is null, so it appears in place; later tab changes slide
    // Counts can change a tab's width: follow it.
    const observer = new ResizeObserver(() => measure());
    if (listRef.current) observer.observe(listRef.current);
    return () => observer.disconnect();
  }, [current, items]);

  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <div ref={listRef} className="relative flex w-max gap-1">
        {pill && (
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 left-0 rounded-full bg-black ${pill.animate ? 'transition-[translate,width] duration-300 ease-out motion-reduce:transition-none' : ''}`}
            style={{ width: pill.width, translate: `${pill.left}px 0` }}
          />
        )}
        {items.map((item, i) => {
          const active = item.key === current;
          return (
            <Link
              key={item.key || 'all'}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              href={item.href}
              onNavigate={(e) => {
                e.preventDefault();
                if (!active) navigate(item.href);
              }}
              aria-current={active ? 'page' : undefined}
              className={`relative whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors duration-300 ${
                active ? `text-white ${pill ? '' : 'bg-black'}` : 'text-stone-600 hover:bg-stone-100 hover:text-black'
              }`}
            >
              {item.label}
              {item.count != null && <span className={`ml-1.5 tabular-nums transition-colors duration-300 ${active ? 'text-white/60' : 'text-stone-400'}`}>{item.count}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** GET search form (works without JS) that navigates through PendingNavProvider, so results show a skeleton. */
export function PendingSearchForm({ action, params = {}, defaultValue = '', label, placeholder, inputClassName = '', buttonClassName = '' }) {
  const { navigate } = usePendingNav();
  const id = useId();

  function onSubmit(e) {
    e.preventDefault();
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value);
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
    if (q) qs.set('q', q);
    const s = qs.toString();
    navigate(s ? `${action}?${s}` : action);
  }

  return (
    <form action={action} onSubmit={onSubmit} role="search" className="flex gap-2">
      {Object.entries(params).map(([key, value]) => value && <input key={key} type="hidden" name={key} value={value} />)}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input id={id} name="q" type="search" defaultValue={defaultValue} placeholder={placeholder} className={inputClassName} />
      <button type="submit" className={buttonClassName}>
        Search
      </button>
    </form>
  );
}
