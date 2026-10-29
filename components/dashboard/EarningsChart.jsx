import { formatPrice } from '@/lib/utils';

const usd = (cents) => formatPrice(cents, 'USD');
const compact = (cents) => {
  const dollars = cents / 100;
  return dollars >= 1000 ? `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}k` : `$${Math.round(dollars)}`;
};

/**
 * Monthly earnings as single-series columns (brand yellow with a gold edge so the bars hold up on white). Pure CSS / server-rendered.
 * Columns: ≤24px wide, 4px rounded data-end, square at the shared baseline; recessive gridlines; hover/focus
 * tooltip per month (the whole column is the hit target). Pair it with a table of the same numbers.
 */
export default function EarningsChart({ months, title = 'Monthly earnings' }) {
  const max = Math.max(...months.map((m) => m.earnings), 0);
  const top = max > 0 ? max : 1;
  const ticks = max > 0 ? [max, max / 2, 0] : [0];

  return (
    <figure aria-label={`${title}, last ${months.length} months`} className="px-5 pb-5 pt-6">
      <div className="flex gap-3">
        {/* Y axis labels (recessive) */}
        <div aria-hidden="true" className="flex h-48 w-10 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-stone-400">
          {max > 0 ? ticks.map((t) => <span key={t}>{compact(t)}</span>) : <span className="mt-auto">$0</span>}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Gridlines */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-48">
            {[0, 50, 100].map((pct) => (
              <span key={pct} className={`absolute inset-x-0 border-t ${pct === 100 ? 'border-stone-300' : 'border-dashed border-stone-200'}`} style={{ top: `${pct}%` }} />
            ))}
          </div>

          <ol className="relative flex h-48 items-end">
            {months.map((m, i) => {
              const height = m.earnings > 0 ? Math.max(2, (m.earnings / top) * 100) : 0;
              return (
                <li
                  key={m.month}
                  tabIndex={0}
                  aria-label={`${m.label}: ${usd(m.earnings)} earned from ${m.sales} sale${m.sales === 1 ? '' : 's'}`}
                  className="group relative flex h-full flex-1 items-end justify-center rounded-md outline-none hover:bg-stone-100/70 focus-visible:bg-stone-100/70 focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  {height > 0 && <span className="w-full max-w-6 rounded-t-[4px] bg-brand-500 ring-1 ring-brand-700/30 ring-inset" style={{ height: `${height}%` }} />}
                  {/* Tooltip */}
                  <span
                    role="tooltip"
                    className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-lg bg-black px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block group-focus-visible:block ${
                      i < 2 ? 'left-0' : i > months.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                    }`}
                  >
                    <span className="block font-medium">{m.label}</span>
                    <span className="block tabular-nums text-white/80">
                      {usd(m.earnings)} · {m.sales} sale{m.sales === 1 ? '' : 's'}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          {/* X axis labels — every other month on phones */}
          <ol aria-hidden="true" className="mt-2 flex text-[11px] text-stone-500">
            {months.map((m, i) => (
              <li key={m.month} className={`flex-1 text-center ${i % 2 === 1 ? 'max-sm:invisible' : ''}`}>
                {m.label.split(' ')[0]}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </figure>
  );
}
