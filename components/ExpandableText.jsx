'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Long text shown to `collapsedHeight` px with a fade, and a "Learn more" button to open it all. The button only
 * appears when the content is actually longer than that.
 */
export default function ExpandableText({ children, collapsedHeight = 220, moreLabel = 'Learn more about this item', lessLabel = 'Show less' }) {
  const ref = useRef(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setLong(el.scrollHeight > collapsedHeight + 24);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsedHeight]);

  const clipped = long && !open;
  return (
    <div>
      <div id={id} className="relative overflow-hidden" style={clipped ? { maxHeight: collapsedHeight } : undefined}>
        <div ref={ref}>{children}</div>
        {clipped && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-white/0" />
        )}
      </div>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className="mx-auto mt-3 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-stone-100"
        >
          {open ? lessLabel : moreLabel}
          <ChevronDown size={16} strokeWidth={2} aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}
