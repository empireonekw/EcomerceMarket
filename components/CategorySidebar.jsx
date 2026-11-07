'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '@/components/PrefetchLink';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronLeft, LayoutGrid, X } from 'lucide-react';

/**
 * Category navigation for product lists. `nav` = { up: [{ name, href }], current: { name, href, count } | null,
 * links: [{ id, name, href, count, active }] }: "up" links (All categories, the parent) with a back arrow, the
 * current category in bold, and its sub-categories (or siblings) underneath.
 * Large screens: a sticky column on the left. Phones and tablets: a "Categories" button opening a panel that slides
 * in from the left.
 */
const SHOW_FIRST = 8; // sub-categories listed before "Show all"

function NavList({ nav, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const extra = nav.links.length - SHOW_FIRST;
  // Collapsed: the first few, plus the selected one wherever it is in the list.
  const shown = expanded || extra <= 1 ? nav.links : nav.links.filter((l, i) => i < SHOW_FIRST || l.active);
  const count = (n) => n > 0 && <span className="shrink-0 text-xs text-stone-400 tabular-nums">{n.toLocaleString('en-US')}</span>;

  return (
    <nav aria-label="Categories" className="text-sm">
      {nav.up.length > 0 && (
        <ul className="mb-3 space-y-0.5">
          {nav.up.map((u) => (
            <li key={u.href}>
              <Link
                href={u.href}
                onClick={onNavigate}
                className="group flex items-center gap-2 py-1 text-stone-500 transition-colors hover:text-ink"
              >
                <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" className="shrink-0 transition-transform group-hover:-translate-x-0.5" />
                <span className="truncate">{u.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {nav.current && (
        <Link
          href={nav.current.href}
          onClick={onNavigate}
          className="flex items-baseline justify-between gap-3 py-2 text-base font-semibold text-ink hover:underline"
        >
          <span className="min-w-0 break-words">{nav.current.name}</span>
          {count(nav.current.count)}
        </Link>
      )}
      {shown.length > 0 && (
        <ul className="mt-1 space-y-px">
          {shown.map((l) => (
            <li key={l.id}>
              <Link
                href={l.href}
                onClick={onNavigate}
                aria-current={l.active ? 'page' : undefined}
                className={`relative flex items-baseline justify-between gap-3 rounded-md py-2 pr-1 pl-4 transition-colors before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full ${
                  l.active ? 'font-semibold text-ink before:bg-ink' : 'text-stone-600 before:bg-transparent hover:text-ink hover:before:bg-stone-300'
                }`}
              >
                <span className="min-w-0 break-words">{l.name}</span>
                {count(l.count)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {extra > 1 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 inline-flex items-center gap-1 rounded-full py-1 pl-4 text-sm font-semibold text-ink underline-offset-4 hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${nav.links.length}`}
          <ChevronDown size={15} strokeWidth={2} aria-hidden="true" className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </nav>
  );
}

/** Fades the top / bottom edge of a scroll area while there's more to scroll that way (no hard cut-off). */
function useEdgeFade(ref) {
  const [mask, setMask] = useState(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop > 2;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setMask(
        top || bottom
          ? `linear-gradient(to bottom, ${top ? 'transparent, black 2.5rem' : 'black'}, ${bottom ? 'black calc(100% - 3rem), transparent' : 'black'})`
          : undefined,
      );
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [ref]);
  return mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined;
}

/** The desktop column: sticks while the products scroll; a long list scrolls inside it, its edges fading. */
export function CategoryColumn({ nav }) {
  const ref = useRef(null);
  const fade = useEdgeFade(ref);
  return (
    <aside className="hidden lg:block">
      <div
        ref={ref}
        style={fade}
        className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain pr-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-caps text-stone-400">Categories</h2>
        <NavList nav={nav} />
      </div>
    </aside>
  );
}

/** The phone / tablet button + slide-in panel. */
export function CategoryDrawerButton({ nav }) {
  const dialogRef = useRef(null);
  const listRef = useRef(null);
  const fade = useEdgeFade(listRef);
  const pathname = usePathname();
  const close = () => dialogRef.current?.close();
  useEffect(close, [pathname]); // a category was picked: close once the new page shows

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-ink transition-colors hover:border-ink lg:hidden"
      >
        <LayoutGrid size={16} strokeWidth={1.75} aria-hidden="true" />
        Categories
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Categories"
        onClick={(e) => e.target === e.currentTarget && close()}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-[min(20rem,86vw)] max-w-none bg-white p-0 text-ink shadow-2xl backdrop:bg-black/40 open:animate-slide-in-left motion-reduce:open:animate-none"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <h2 className="font-semibold">Categories</h2>
            <button type="button" onClick={close} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-stone-100">
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          <div ref={listRef} style={fade} className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            <NavList nav={nav} />
          </div>
        </div>
      </dialog>
    </>
  );
}
