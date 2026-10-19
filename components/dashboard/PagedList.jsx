'use client';

import { Children, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Client-side pagination for a short, already-loaded list. Pass server-rendered <li> children;
 * it shows `pageSize` at a time with "1–8 of 23" and previous/next controls (hidden when one page fits).
 */
export default function PagedList({ children, pageSize = 8, className = '', label = 'items' }) {
  const items = Children.toArray(children);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const [page, setPage] = useState(1);
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;

  return (
    <>
      <ul className={className}>{items.slice(start, start + pageSize)}</ul>
      {pages > 1 && (
        <nav aria-label={`${label} pages`} className="flex items-center justify-between gap-3 border-t border-stone-100 px-5 py-2.5 text-sm text-stone-500">
          <span className="tabular-nums" aria-live="polite">
            {start + 1}–{Math.min(start + pageSize, items.length)} of {items.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current === 1}
              aria-label="Previous page"
              className="grid size-8 place-items-center rounded-full text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-30"
            >
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="min-w-12 text-center tabular-nums">
              {current} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current === pages}
              aria-label="Next page"
              className="grid size-8 place-items-center rounded-full text-stone-700 transition-colors hover:bg-stone-100 disabled:opacity-30"
            >
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
