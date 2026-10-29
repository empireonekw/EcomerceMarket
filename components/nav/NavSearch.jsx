'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Form from 'next/form';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, SearchX } from 'lucide-react';
import { escapeRegex, formatPrice, searchTokens, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';

const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 6;

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Bolds the parts of `text` that matched (same word-prefix rule the server uses). No innerHTML. */
function Highlight({ text, query }) {
  const tokens = searchTokens(query);
  if (!tokens.length) return text;
  const rx = new RegExp(`\\b(?:${tokens.map(escapeRegex).join('|')})`, 'gi');
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(rx)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <mark key={m.index} className="rounded-sm bg-amber-100 px-px text-black">
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

function SkeletonRows() {
  return (
    <ul aria-hidden="true" className="divide-y divide-stone-100">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex animate-pulse items-center gap-3 px-3 py-2.5">
          <span className="h-9 w-12 shrink-0 rounded-md bg-stone-200" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3 w-3/4 rounded bg-stone-200" />
            <span className="block h-2.5 w-1/3 rounded bg-stone-200" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Navbar search with live autocomplete (ARIA combobox).
 * - Fetches /api/search 300ms after typing stops; stale requests are aborted, results cached per query.
 * - ↑/↓ move through results, Enter opens the highlighted product (or the full results page), Esc closes.
 * - Without JS it's still a plain GET form to /products?q=…
 * @param {{ block?: boolean }} props  block = full width with inline results (mobile menu)
 */
export default function NavSearch({ id = 'nav-search', className = '', block = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef(null);
  const cache = useRef(new Map());
  const listboxId = useId();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState({ items: [], total: 0, error: false });
  const [fetching, setFetching] = useState(false);
  const [active, setActive] = useState(-1);

  const term = query.trim();
  const debounced = useDebouncedValue(term, DEBOUNCE_MS);
  const settled = term === debounced;
  const loading = Boolean(term) && (!settled || fetching);
  const viewAllHref = `/products?q=${encodeURIComponent(term)}`;

  // Fetch suggestions for the debounced term.
  useEffect(() => {
    if (!debounced) return setResult({ items: [], total: 0, error: false });
    const cached = cache.current.get(debounced);
    if (cached) return setResult(cached);

    const controller = new AbortController();
    setFetching(true);
    fetch(`/api/search?q=${encodeURIComponent(debounced)}&limit=${RESULT_LIMIT}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        const next = { items: data.items ?? [], total: data.total ?? 0, error: false };
        cache.current.set(debounced, next);
        setResult(next);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setResult({ items: [], total: 0, error: true });
      })
      .finally(() => {
        if (!controller.signal.aborted) setFetching(false);
      });
    return () => controller.abort(); // a newer term supersedes this request
  }, [debounced]);

  useEffect(() => setActive(-1), [result]);
  useEffect(() => setOpen(false), [pathname]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const options = result.items;
  const showPanel = open && Boolean(term);
  const optionId = (i) => `${listboxId}-opt-${i}`;

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (showPanel) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (!showPanel || !options.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const last = options.length; // index `options.length` = "View all" row
      setActive((i) => (e.key === 'ArrowDown' ? (i >= last ? 0 : i + 1) : i <= 0 ? last : i - 1));
    } else if (e.key === 'Enter' && active >= 0 && active < options.length) {
      e.preventDefault();
      setOpen(false);
      router.push(`/products/${options[active].slug}`);
    }
    // Enter with nothing (or "View all") highlighted falls through to the form → /products?q=…
  }

  const panelPosition = block
    ? 'mt-2'
    : 'absolute right-0 top-full z-50 mt-2 w-[min(26rem,calc(100vw-2rem))]';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {/* relative: the icon button is positioned against the input row, not the (inline, on mobile) results panel. */}
      <Form action="/products" role="search" onSubmit={() => setOpen(false)} className="relative">
        <label htmlFor={id} className="sr-only">
          Search products
        </label>
        <input
          id={id}
          name="q"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => term && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
          className={`peer h-10 rounded-full border border-stone-200 bg-white pl-10 pr-4 text-sm placeholder:text-stone-500 transition-colors focus:border-stone-400 focus:outline-none [&::-webkit-search-cancel-button]:hidden ${
            block ? 'w-full' : 'w-44 xl:w-56'
          }`}
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute left-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center text-stone-500 transition-colors hover:text-black peer-focus:text-black"
        >
          {/* Always the search icon: loading is shown by the skeleton rows in the results panel. */}
          <Search className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </Form>

      {/* Screen-reader announcement of result counts. */}
      <p aria-live="polite" className="sr-only">
        {showPanel && settled && !fetching ? (result.error ? 'Search unavailable' : `${result.total} results`) : ''}
      </p>

      {showPanel && (
        <div className={`${panelPosition} overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-xl`}>
          {loading && options.length === 0 ? (
            <SkeletonRows />
          ) : result.error ? (
            <p className="px-4 py-6 text-center text-sm text-stone-500">Search is unavailable right now. Press Enter to search anyway.</p>
          ) : options.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-7 text-center">
              <SearchX className="w-6 h-6 text-stone-400" strokeWidth={1.75} aria-hidden="true" />
              <p className="text-sm font-medium text-stone-900">No digital goods found</p>
              <p className="text-xs text-stone-500">
                Nothing matches “{term}”.{' '}
                <Link href="/products" onClick={() => setOpen(false)} className="font-medium text-stone-900 underline underline-offset-2">
                  Browse all products
                </Link>
              </p>
            </div>
          ) : (
            <>
              <ul id={listboxId} role="listbox" aria-label="Product suggestions" className={`divide-y divide-stone-100 ${loading ? 'opacity-60' : ''}`}>
                {options.map((p, i) => (
                  <li key={p._id} role="presentation">
                    <Link
                      id={optionId(i)}
                      role="option"
                      aria-selected={active === i}
                      href={`/products/${p.slug}`}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${active === i ? 'bg-stone-50' : ''}`}
                    >
                      <span className="relative h-9 w-12 shrink-0 overflow-hidden rounded-md bg-stone-100">
                        {p.coverImage && (
                          <Image src={p.coverImage} alt="" fill sizes="48px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-stone-900">
                          <Highlight text={p.title} query={term} />
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          {p.category?.name && (
                            <span className="rounded-full bg-stone-100 px-2 py-px text-[11px] font-medium text-stone-600">{p.category.name}</span>
                          )}
                          <span className="text-xs font-medium text-stone-900">{p.price === 0 ? 'Free' : formatPrice(p.price, p.currency)}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
                {/* Last option, so ↑/↓ can reach it and screen readers announce it. */}
                <li role="presentation" className="border-t border-stone-200">
                  <Link
                    href={viewAllHref}
                    id={optionId(options.length)}
                    role="option"
                    aria-selected={active === options.length}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActive(options.length)}
                    className={`block px-4 py-2.5 text-center text-sm font-medium text-stone-900 transition-colors ${
                      active === options.length ? 'bg-stone-50' : ''
                    }`}
                  >
                    View all {result.total} result{result.total === 1 ? '' : 's'}
                  </Link>
                </li>
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
