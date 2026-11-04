'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A row of filter pills that scrolls sideways: edges fade where more pills are hidden, with ‹ › buttons (mouse
 * users) to scroll a page at a time. Touch and trackpad scroll as usual. The active pill is brought into view.
 */
export default function ChipScroller({ label, children, className = '', bleed = true }) {
  // `bleed`: on phones the row runs to the screen edges (when it has the full width to itself).
  const ref = useRef(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const active = el.querySelector('[aria-current]');
    if (active && active.offsetLeft + active.offsetWidth > el.clientWidth) el.scrollLeft = active.offsetLeft - el.clientWidth / 3;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: 'smooth' });
  const arrow =
    'absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-stone-200 bg-white text-ink shadow-md transition hover:border-ink sm:grid';

  return (
    <div className={`relative min-w-0 ${className}`}>
      <nav
        ref={ref}
        aria-label={label}
        onScroll={measure}
        className={`flex gap-2 overflow-x-auto scroll-smooth py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${bleed ? '-mx-4 px-4 sm:mx-0 sm:px-0' : ''}`}
      >
        {children}
      </nav>
      {/* Fades: there's more this way. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 w-16 bg-gradient-to-r from-white via-white/70 to-white/0 transition-opacity sm:left-0 ${bleed ? '-left-4' : 'left-0'} ${edges.start ? 'opacity-100' : 'opacity-0'}`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 w-16 bg-gradient-to-l from-white via-white/70 to-white/0 transition-opacity sm:right-0 ${bleed ? '-right-4' : 'right-0'} ${edges.end ? 'opacity-100' : 'opacity-0'}`}
      />
      {edges.start && (
        <button type="button" onClick={() => scroll(-1)} aria-label="Scroll left" className={`${arrow} -left-1`}>
          <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      {edges.end && (
        <button type="button" onClick={() => scroll(1)} aria-label="Scroll right" className={`${arrow} -right-1`}>
          <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
