'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';

/**
 * The dashboard's header (title left, date filter and actions right, above everything they scope) and the content. Choosing a range
 * reloads the page's data in a transition: the current charts stay on screen, dimmed, until the new ones arrive.
 * presets: [{ key, label }]; range: { key, label, from, to }
 */
export default function RangeShell({ title, description, presets, range, today, actions, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(true);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !menu.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => (document.removeEventListener('pointerdown', close), document.removeEventListener('keydown', esc));
  }, [open]);

  const go = (query) => {
    setOpen(false);
    startTransition(() =>
      router.push(`${pathname}?${new URLSearchParams(query)}`, {
        scroll: false,
      }),
    );
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {description} Compared with the {range.compareLabel}.{pending && <span className="ml-2 text-stone-400">Updating…</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={menu}>
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={open}
              onClick={(e) => {
                // Open towards the side with room: right-aligned when the button sits at the right of the header,
                // left-aligned when the header has wrapped it to the left (narrow screens).
                const { left } = e.currentTarget.getBoundingClientRect();
                setAlignRight(left + 288 > window.innerWidth - 8);
                setOpen((v) => !v);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(16,16,16,0.04)] hover:border-stone-300"
            >
              <CalendarDays size={16} strokeWidth={1.75} aria-hidden="true" className="text-stone-500" />
              {range.label}
              <ChevronDown size={15} strokeWidth={2} aria-hidden="true" className="text-stone-400" />
            </button>
            {open && (
              <div className={`absolute ${alignRight ? 'right-0' : 'left-0'} z-30 mt-2 w-72 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_24px_50px_-20px_rgba(16,16,16,0.25)]`}>
                <ul aria-label="Date range">
                  {presets.map((p) => (
                    <li key={p.key}>
                      <button
                        type="button"
                        onClick={() => go({ range: p.key })}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-50"
                        aria-current={p.key === range.key || undefined}
                      >
                        <span className={p.key === range.key ? 'font-semibold text-ink' : 'text-stone-700'}>{p.label}</span>
                        {p.key === range.key && <Check size={16} strokeWidth={2.5} aria-hidden="true" />}
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-1.5 border-t border-stone-100 px-3 pt-3 pb-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (from && to) go({ from, to });
                  }}
                >
                  <p className="text-xs font-medium text-stone-500">Custom range</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs text-stone-500">
                      From
                      <input
                        type="date"
                        value={from}
                        max={to || today}
                        onChange={(e) => setFrom(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-stone-300 px-2 text-sm text-ink focus:border-ink focus:outline-none"
                      />
                    </label>
                    <label className="text-xs text-stone-500">
                      To
                      <input
                        type="date"
                        value={to}
                        min={from}
                        max={today}
                        onChange={(e) => setTo(e.target.value)}
                        className="mt-1 h-9 w-full rounded-lg border border-stone-300 px-2 text-sm text-ink focus:border-ink focus:outline-none"
                      />
                    </label>
                  </div>
                  <button type="submit" className="btn btn-sm btn-dark mt-3 w-full">
                    Apply
                  </button>
                </form>
              </div>
            )}
          </div>
          {actions}
        </div>
      </div>
      <div aria-busy={pending} className={`transition-opacity duration-200 ${pending ? 'opacity-50' : ''}`}>
        {children}
      </div>
    </>
  );
}
