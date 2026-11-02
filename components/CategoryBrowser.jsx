'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search, X } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { categoryHref, searchCategories } from '@/lib/category-tree';

// Same pastel order as the Shop menu and the homepage.
const TINTS = ['bg-brand-50', 'bg-tint-mint', 'bg-tint-butter', 'bg-tint-sky', 'bg-tint-blush', 'bg-tint-sage'];
const SUBS_SHOWN = 8;
const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'popular', label: 'Most products' },
  { value: 'az', label: 'A–Z' },
];
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * The /categories grid with a search box and sorting. The search matches main, sub and inner category names (typos
 * are fine, lib/category-tree.js searchCategories) and shows each match under its main category, highlighted.
 * The search is kept in the URL (?q=) so a filtered list can be shared. `categories` = the whole tree, in order.
 */
export default function CategoryBrowser({ mains, categories }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');

  // Start from ?q= and keep it in the address bar without re-rendering the page.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q.slice(0, 80));
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set('q', query.trim());
    else url.searchParams.delete('q');
    window.history.replaceState(window.history.state, '', url);
  }, [query]);

  const searching = query.trim().length > 0;
  const results = useMemo(() => {
    const index = new Map(mains.map((c, i) => [c._id, i]));
    if (!searching) {
      const list = mains.map((c) => ({ main: c, matches: [] }));
      if (sort === 'popular') list.sort((a, b) => (b.main.totalCount ?? 0) - (a.main.totalCount ?? 0) || index.get(a.main._id) - index.get(b.main._id));
      if (sort === 'az') list.sort((a, b) => a.main.name.localeCompare(b.main.name));
      return list;
    }
    // Best match first; a sub or inner match brings in its main category, with the match listed on the card.
    const byMain = new Map();
    for (const c of searchCategories(query, categories, 200, { strict: true })) {
      const mainId = c.depth === 0 ? c._id : c.ancestors[0];
      if (!index.has(mainId)) continue;
      if (!byMain.has(mainId)) byMain.set(mainId, { main: mains[index.get(mainId)], matches: [] });
      if (c.depth > 0) byMain.get(mainId).matches.push(c);
    }
    return [...byMain.values()];
  }, [mains, categories, query, searching, sort]);

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="category-search" className="sr-only">
            Search categories
          </label>
          <Search size={17} strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            id="category-search"
            type="search"
            value={query}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories, e.g. rings, planners"
            className="h-12 w-full rounded-full border border-stone-300 bg-white pl-11 pr-11 text-[15px] placeholder:text-stone-400 hover:border-stone-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-brand-500/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-black"
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="category-sort" className="text-stone-500">
            Sort
          </label>
          <select
            id="category-sort"
            value={searching ? 'match' : sort}
            disabled={searching}
            onChange={(e) => setSort(e.target.value)}
            className="h-10 rounded-full border border-stone-300 bg-white px-4 text-sm hover:border-stone-400 focus:border-ink focus:outline-none disabled:text-stone-400"
          >
            {searching && <option value="match">Best match</option>}
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-4 min-h-5 text-sm text-stone-500" role="status">
        {searching && `${plural(results.length, 'category', 'categories')} ${results.length === 1 ? 'matches' : 'match'} “${query.trim()}”`}
      </p>

      {results.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-stone-300 px-6 py-12 text-center">
          <p className="font-medium text-ink">No categories match “{query.trim()}”.</p>
          <p className="mt-1 text-sm text-stone-500">Check the spelling, or search the products instead.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setQuery('')} className="btn btn-md btn-outline">
              Show all categories
            </button>
            <Link href={`/products?q=${encodeURIComponent(query.trim())}`} className="btn btn-md btn-dark">
              Search products for “{query.trim()}”
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(({ main: c, matches }) => {
            const tint = TINTS[mains.indexOf(c) % TINTS.length];
            const matched = new Set(matches.map((m) => m._id));
            // Matches first (inner ones named with their sub), then the main's other sub-categories.
            const chips = [
              ...matches.map((m) => ({ ...m, label: m.depth > 1 ? m.path.split(' › ').slice(1).join(' › ') : m.name })),
              ...categories.filter((s) => s.parent === c._id && !matched.has(s._id)).map((s) => ({ ...s, label: s.name })),
            ];
            return (
              <li key={c._id} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 transition-shadow hover:shadow-card">
                <Link href={categoryHref(c)} className="group flex items-start gap-3">
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-full text-gray-900 transition-colors group-hover:bg-gray-900 group-hover:text-white ${tint}`}
                  >
                    <CategoryIcon slug={c.slug} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium break-words text-ink first-letter:uppercase group-hover:underline">{c.name}</span>
                    <span className="text-sm text-stone-500">{plural(c.totalCount ?? 0, 'product')}</span>
                  </span>
                  <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-stone-400 transition-colors group-hover:text-ink" />
                </Link>
                {c.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-stone-600">{c.description}</p>}
                {chips.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${c.name} sub-categories`}>
                    {chips.slice(0, Math.max(SUBS_SHOWN, matches.length)).map((s) => (
                      <li key={s._id}>
                        <Link
                          href={categoryHref(s)}
                          className={`inline-flex rounded-full border px-3 py-1 text-xs transition-colors hover:border-ink hover:text-ink ${
                            matched.has(s._id) ? 'border-brand-300 bg-brand-50 font-medium text-ink' : 'border-stone-200 text-stone-700'
                          }`}
                        >
                          {s.label}
                        </Link>
                      </li>
                    ))}
                    {chips.length > Math.max(SUBS_SHOWN, matches.length) && (
                      <li>
                        <Link href={categoryHref(c)} className="inline-flex rounded-full px-3 py-1 text-xs font-medium text-ink hover:underline">
                          +{chips.length - Math.max(SUBS_SHOWN, matches.length)} more
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
