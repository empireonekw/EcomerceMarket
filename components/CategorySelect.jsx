'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, History, Search, SearchX } from 'lucide-react';
import { findBasicCategories } from '@/lib/basic-categories';

/** The main › sub › inner ids of category `id` (empty strings below it). */
function levelsOf(id, categories) {
  const c = categories.find((x) => x._id === id);
  if (!c) return ['', '', ''];
  const ids = [...c.ancestors, c._id];
  return [ids[0] ?? '', ids[1] ?? '', ids[2] ?? ''];
}

const SIZES = {
  // Seller listing form
  lg: { select: 'h-12 rounded-xl px-4 text-[15px]', label: 'text-sm', error: 'mt-2 text-sm', gap: 'gap-4' },
  // Admin product form
  md: { select: 'h-11 rounded-xl px-3.5 text-sm', label: 'text-sm', error: 'mt-1.5 text-xs', gap: 'gap-3' },
};

/** One category as a main › sub › inner chip (the last name bold). */
function PickChip({ pick, on, onPick }) {
  return (
    <li className="min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => onPick(pick.id)}
        aria-pressed={on}
        className={`flex max-w-full items-center gap-1 rounded-full border px-3.5 py-2 text-left text-sm transition-colors ${
          on ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-ink hover:text-ink'
        }`}
      >
        {on && <Check size={15} strokeWidth={2.5} aria-hidden="true" className="mr-0.5 shrink-0" />}
        {pick.trail.map((name, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight size={13} strokeWidth={2} aria-hidden="true" className={`shrink-0 ${on ? 'text-white/60' : 'text-stone-400'}`} />}
            <span className={`truncate ${i === pick.trail.length - 1 ? 'font-semibold' : ''}`}>{name}</span>
          </span>
        ))}
      </button>
    </li>
  );
}

/**
 * Category: Main, then Sub, then Inner, each a plain dropdown of what's under the one before (set up under
 * Admin → Categories), so every product sits in its place on the category pages. Used by the seller listing form
 * and the admin product form. A sub category is required when the main has any; the inner one is optional.
 * `onChange(id)` gets the deepest picked id, or '' while a required sub is still missing.
 * `categories` = the tree from getCategories() (with `parent` and `ancestors`).
 * `recent` = ids of the seller's last few categories (newest first): shown above as one-click "Recently used" picks
 * (main › sub › inner), so listing several similar items doesn't mean choosing all three levels every time.
 * The search box above finds any category by name; "Can't find your category?" below offers the general
 * ones (Digital › Digital › Digital, Public › Public › Public, lib/basic-categories.js) that fill all three levels in one click.
 */
export default function CategorySelect({ categories, value, onChange, error, recent = [], size = 'lg', className = '' }) {
  const s = SIZES[size];
  const [levels, setLevels] = useState(() => levelsOf(value, categories));
  // A new value from outside (the form loading a product): show it. The form's own '' (sub missing) keeps the picks.
  useEffect(() => {
    if (value) setLevels(levelsOf(value, categories));
  }, [value, categories]);

  const childrenOf = (parentId) => categories.filter((c) => (c.parent ?? null) === parentId);
  const [main, sub] = levels;
  const options = [childrenOf(null), main ? childrenOf(main) : [], sub ? childrenOf(sub) : []];
  const needsSub = Boolean(main) && options[1].length > 0 && !sub;

  function pick(level, id) {
    const next = [...levels.slice(0, level), id, '', ''].slice(0, 3);
    setLevels(next);
    const deepest = next.findLast(Boolean) ?? '';
    // A main that has sub categories only groups them: nothing to store until a sub is picked.
    onChange(next[0] && !next[1] && childrenOf(next[0]).length ? '' : deepest);
  }

  // Which dropdown the error belongs to: the one still to be filled in.
  const errorAt = error ? (!main ? 0 : needsSub ? 1 : -1) : -1;
  const message = errorAt === 1 ? 'Choose a sub category.' : error;
  const fields = [
    // Short placeholders: the label above already names the level, and three columns are narrow.
    { id: 'category', label: 'Main category', required: true, placeholder: 'Choose…' },
    { id: 'category-sub', label: 'Sub category', required: options[1].length > 0, placeholder: main ? 'Choose…' : 'Pick main first' },
    { id: 'category-inner', label: 'Inner category', required: false, placeholder: sub ? 'Choose…' : 'Pick sub first' },
  ];
  const errorText = (
    <p id="category-error" className={`${s.error} font-medium text-red-600`}>
      {message}
    </p>
  );

  // Still-active categories only (an admin may have removed one), each shown as its main › sub › inner trail.
  const byId = new Map(categories.map((c) => [c._id, c]));
  const asPick = (c) => ({ id: c._id, trail: [...c.ancestors.map((a) => byId.get(a)?.name).filter(Boolean), c.name] });
  const recentPicks = recent
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map(asPick);
  const basicPicks = findBasicCategories(categories);
  const [query, setQuery] = useState('');
  const usePick = (id) => {
    setLevels(levelsOf(id, categories));
    onChange(id);
    setQuery('');
  };

  // Search: every word typed must appear in the category's main › sub › inner names. A main category that has sub
  // categories isn't offered on its own (a sub is required under it).
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const found = words.length
    ? categories
        .filter((c) => c.parent || childrenOf(c._id).length === 0)
        .map(asPick)
        .filter((p) => words.every((w) => p.trail.join(' ').toLowerCase().includes(w)))
        .slice(0, 8)
    : [];

  return (
    <div className={className}>
      <div className="mb-4">
        <label htmlFor="category-search" className={`${s.label} font-medium text-stone-700`}>
          Search categories
        </label>
        <div className="relative mt-1.5">
          <Search
            size={17}
            strokeWidth={1.75}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            id="category-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Enter picks the first match instead of submitting the listing form.
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (found[0]) usePick(found[0].id);
            }}
            placeholder="e.g. Notion, planner, eBook"
            autoComplete="off"
            className={`${s.select} w-full border border-stone-300 bg-white pl-10 hover:border-stone-400 focus:border-ink focus:outline-none focus:ring-2 focus:ring-brand-500/20`}
          />
        </div>
        {words.length > 0 &&
          (found.length ? (
            <ul aria-label="Matching categories" className="mt-2 flex flex-wrap gap-2">
              {found.map((p) => (
                <PickChip key={p.id} pick={p} on={p.id === value} onPick={usePick} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-stone-500">
              No category matches “{query.trim()}”.{basicPicks.length > 0 && ' Use a general one under “Can’t find your category?” below.'}
            </p>
          ))}
      </div>
      {recentPicks.length > 0 && (
        <div className="mb-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <History size={14} strokeWidth={2} aria-hidden="true" />
            Recently used
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recentPicks.map((p) => (
              <PickChip key={p.id} pick={p} on={p.id === value} onPick={usePick} />
            ))}
          </ul>
          <p className="mt-3 text-xs text-stone-500">Or choose below:</p>
        </div>
      )}
      <div className={`grid grid-cols-1 lg:grid-cols-3 ${s.gap}`}>
        {fields.map((f, level) => {
          const list = options[level];
          // The level above is picked but has nothing under it (an inner category is optional anyway).
          const empty = level > 0 && levels[level - 1] && list.length === 0;
          const invalid = errorAt === level;
          return (
            <div key={f.id} className="min-w-0">
              <label htmlFor={f.id} className={`${s.label} font-medium text-stone-700`}>
                {f.label} {f.required ? <span className="text-red-600">*</span> : <span className="font-normal text-stone-400">(optional)</span>}
              </label>
              <div className="relative mt-1.5">
                <select
                  id={f.id}
                  value={levels[level]}
                  disabled={level > 0 && (!levels[level - 1] || empty)}
                  onChange={(e) => pick(level, e.target.value)}
                  aria-invalid={invalid || undefined}
                  aria-describedby={invalid ? 'category-error' : undefined}
                  className={`${s.select} w-full appearance-none border bg-white pr-11 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400 ${
                    invalid ? 'border-red-400 focus:border-red-500' : 'border-stone-300 hover:border-stone-400 focus:border-ink'
                  }`}
                >
                  <option value="">{empty ? 'None available' : f.placeholder}</option>
                  {list.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500"
                />
              </div>
              {invalid && errorText}
            </div>
          );
        })}
        {error && errorAt === -1 && <div className="lg:col-span-3">{errorText}</div>}
      </div>
      {basicPicks.length > 0 && (
        <div className="mt-4 rounded-xl bg-stone-50 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
            <SearchX size={15} strokeWidth={1.75} aria-hidden="true" />
            Can’t find your category?
          </p>
          <p className="mt-0.5 text-xs text-stone-500">Pick a general one. It fills in all three fields in one click.</p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {basicPicks.map((p) => (
              <PickChip key={p.id} pick={p} on={p.id === value} onPick={usePick} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
