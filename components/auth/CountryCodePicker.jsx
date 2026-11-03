'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { PHONE_COUNTRIES, normalizeCountryCode } from '@/lib/validation';

/** Small country badge ("PK"); used instead of flag emoji, which Windows shows as plain letters anyway. */
function IsoBadge({ iso }) {
  return (
    <span className="grid h-5 min-w-7 place-items-center rounded-md bg-stone-100 px-1 text-[10px] font-semibold tracking-wide text-stone-600 ring-1 ring-inset ring-stone-200">
      {iso ?? '—'}
    </span>
  );
}

/**
 * Country calling-code picker for the sign-up phone field: a compact button (badge + code) that opens a searchable
 * list. Typing a country name or code filters it; typing any code that isn't listed (e.g. "+880" or "57") offers
 * "Use +57", so every country can be entered by hand. Keyboard: ↑ ↓ to move, Enter to pick, Esc to close.
 */
export default function CountryCodePicker({ id, value, onChange, onBlur }) {
  const listId = useId();
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const current = PHONE_COUNTRIES.find((c) => c.code === value);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/[^\d]/g, '');
    const matches = q
      ? PHONE_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.iso.toLowerCase() === q || (digits && c.code.slice(1).startsWith(digits)))
      : PHONE_COUNTRIES;
    const custom = normalizeCountryCode(q);
    const showCustom = custom && /^[+\d\s]+$/.test(q) && !PHONE_COUNTRIES.some((c) => c.code === custom);
    return [...(showCustom ? [{ code: custom, iso: null, name: `Use ${custom}`, custom: true }] : []), ...matches];
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.code === value)));
    searchRef.current?.focus();
    const onDown = (e) => !rootRef.current?.contains(e.target) && close();
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setQuery('');
    onBlur?.();
  }
  function pick(option) {
    onChange(option.code);
    close();
    document.getElementById(id)?.focus();
  }
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, options.length - 1)));
    else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
    else if (e.key === 'Enter') (e.preventDefault(), options[active] && pick(options[active]));
    else if (e.key === 'Escape') (e.preventDefault(), close(), document.getElementById(id)?.focus());
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${current ? `${current.name} ${current.code}` : value}`}
        className={`mt-1.5 flex h-11 w-full items-center gap-2 rounded-xl border bg-white pl-3 pr-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
          open ? 'border-brand-600' : 'border-stone-300 hover:border-stone-400 focus:border-brand-600'
        }`}
      >
        <IsoBadge iso={current?.iso} />
        <span className="font-medium tabular-nums text-ink">{value}</span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" className={`ml-auto text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-72 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_18px_48px_-12px_rgba(20,20,20,0.25)]">
          <div className="border-b border-stone-100 p-2">
            <div className="relative">
              <Search size={15} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                ref={searchRef}
                role="combobox"
                aria-controls={listId}
                aria-expanded="true"
                aria-autocomplete="list"
                aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
                aria-label="Search country or type a code"
                value={query}
                onChange={(e) => (setQuery(e.target.value), setActive(0))}
                onKeyDown={onKeyDown}
                placeholder="Search country or type +code"
                autoComplete="off"
                className="h-9 w-full rounded-lg bg-stone-50 pl-8 pr-3 text-sm placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
          <ul id={listId} role="listbox" aria-label="Country codes" className="max-h-64 overflow-y-auto p-1.5 [scrollbar-width:thin]">
            {options.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-stone-500">No match. Type a code like +57 to use it.</li>
            ) : (
              options.map((o, i) => (
                <li
                  key={`${o.code}-${o.iso ?? 'custom'}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o.code === value}
                  onPointerDown={(e) => (e.preventDefault(), pick(o))}
                  onPointerEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${i === active ? 'bg-stone-100' : ''}`}
                >
                  {o.custom ? (
                    <span className="grid h-5 min-w-7 place-items-center rounded-md bg-brand-50 px-1 text-[10px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">+</span>
                  ) : (
                    <IsoBadge iso={o.iso} />
                  )}
                  <span className={`min-w-0 flex-1 truncate ${o.custom ? 'font-medium text-ink' : 'text-stone-700'}`}>{o.name}</span>
                  {!o.custom && <span className="tabular-nums text-stone-500">{o.code}</span>}
                  {o.code === value && <Check size={15} strokeWidth={2} aria-hidden="true" className="text-brand-600" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
