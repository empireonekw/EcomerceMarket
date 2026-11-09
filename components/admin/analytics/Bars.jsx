// Server-rendered bar figures for the admin dashboard. Hover/focus tooltips are pure CSS; every value is also printed.
import { formatCount, formatPercent, formatValue, GRID, niceTicks, SERIES } from './format';

const pct = (part, whole) => (whole > 0 ? part / whole : 0);

/**
 * One whole split into parts (devices): a thin segmented bar (8px, 2px surface gaps, rounded ends, no text inside)
 * and a legend with every name, count and share.
 * parts: [{ key, label, value }] in a fixed order (colours follow the entity, not its rank).
 */
export function SegmentedBar({ parts, label }) {
  const whole = parts.reduce((a, p) => a + p.value, 0);
  const shown = parts.map((p, i) => ({
    ...p,
    color: SERIES[i % SERIES.length],
    share: pct(p.value, whole),
  }));
  return (
    <figure aria-label={label}>
      <div className="flex h-2 w-full gap-0.5" role="list">
        {whole === 0 ? (
          <span className="h-full w-full rounded-full bg-stone-100" />
        ) : (
          shown
            .filter((p) => p.value > 0)
            .map((p) => (
              <span
                key={p.key}
                role="listitem"
                tabIndex={0}
                aria-label={`${p.label}: ${formatCount(p.value)} (${formatPercent(p.share)})`}
                className="group relative h-full min-w-1 rounded-full outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1"
                style={{ width: `${p.share * 100}%`, background: p.color }}
              >
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-normal text-white shadow-lg group-hover:block group-focus-visible:block"
                >
                  <span className="font-semibold">{formatCount(p.value)}</span> <span className="text-white/70">{p.label}</span>
                </span>
              </span>
            ))
        )}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-y-2 text-sm">
        {shown.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-stone-600">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-ink">
              {formatCount(p.value)} <span className="text-stone-400">{formatPercent(p.share, 0)}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * Ranked horizontal bars (funnels, countries, page types): a thin bar per row under its name, the value at the end.
 * One measure, one colour. `steps`: show each row's share of the row before it (funnels).
 * rows: [{ key, label, value, href?, sub? }]
 */
export function BarList({ rows, kind = 'count', steps = false, emptyText = 'Nothing yet.', color = SERIES[0] }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length || max === 0) return <p className="py-6 text-center text-sm text-stone-500">{emptyText}</p>;
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1].value : null;
        return (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-stone-700">{r.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium text-ink">{formatValue(r.value, kind)}</span>
                {/* A step can only be read as a share of the one before when it's not bigger (counts from different trackers can be). */}
                {steps && prev > 0 && r.value <= prev && (
                  <span className="ml-2 text-xs text-stone-500">{formatPercent(r.value / prev)} of previous</span>
                )}
                {!steps && r.sub && <span className="ml-2 text-xs text-stone-500">{r.sub}</span>}
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full rounded-full bg-stone-100" aria-hidden="true">
              <div
                className="h-1 rounded-full"
                style={{
                  width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / max) * 100)}%`,
                  background: color,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Stacked columns over time (sign-ups: shoppers and sellers): ≤24px columns, 4px rounded top, square at the shared
 * baseline, 2px surface gap between the two parts, a hover/focus tooltip per column, a legend above.
 * buckets: [{ label }]; series: [{ key, label, values: number[] }]
 */
export function StackedColumns({ buckets, series, height = 140 }) {
  const totals = buckets.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const ticks = niceTicks(Math.max(...totals, 0), 3);
  const top = ticks[ticks.length - 1] || 1;
  const n = buckets.length;
  const every = Math.max(1, Math.ceil(n / 7));
  return (
    <figure>
      <ul className="mb-3 flex flex-wrap gap-4 text-xs text-stone-600" aria-label="Legend">
        {series.map((s, si) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: SERIES[si] }} />
            {s.label} <span className="tabular-nums text-stone-400">{formatCount(s.values.reduce((a, b) => a + b, 0))}</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <div aria-hidden="true" className="relative w-8 shrink-0 text-right text-[11px] tabular-nums text-stone-400" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / top) * 100}%` }}>
              {formatCount(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div aria-hidden="true" className="absolute inset-x-0 top-0" style={{ height }}>
            {ticks.map((t) => (
              <span key={t} className="absolute inset-x-0 border-t" style={{ top: `${100 - (t / top) * 100}%`, borderColor: GRID }} />
            ))}
          </div>
          <ol className="relative flex items-end" style={{ height }}>
            {buckets.map((b, i) => (
              <li
                key={b.label + i}
                tabIndex={0}
                aria-label={`${b.label}: ${series.map((s) => `${formatCount(s.values[i])} ${s.label.toLowerCase()}`).join(', ')}`}
                className="group relative flex h-full flex-1 flex-col items-center justify-end rounded outline-none hover:bg-stone-100/70 focus-visible:ring-2 focus-visible:ring-ink"
              >
                <span className="flex w-full max-w-6 flex-col-reverse gap-0.5 px-px" style={{ height: `${(totals[i] / top) * 100}%` }}>
                  {series.map((s, si) =>
                    s.values[i] > 0 ? (
                      <span
                        key={s.key}
                        className={`w-full ${si === series.length - 1 || series.slice(si + 1).every((x) => !x.values[i]) ? 'rounded-t-[4px]' : ''}`}
                        style={{
                          flexGrow: s.values[i],
                          flexBasis: 0,
                          minHeight: 2,
                          background: SERIES[si],
                        }}
                      />
                    ) : null,
                  )}
                </span>
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lg group-hover:block group-focus-visible:block ${
                    i < 3 ? 'left-0' : i > n - 4 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                  }`}
                >
                  <span className="block text-white/70">{b.label}</span>
                  {series.map((s, si) => (
                    <span key={s.key} className="mt-0.5 flex items-center gap-2">
                      <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: SERIES[si] }} />
                      <span className="font-semibold tabular-nums">{formatCount(s.values[i])}</span> {s.label}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
          <ol aria-hidden="true" className="mt-2 flex text-[11px] text-stone-400">
            {buckets.map((b, i) => (
              <li key={b.label + i} className="flex-1 overflow-visible whitespace-nowrap text-center">
                {i % every === 0 ? b.label : ''}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </figure>
  );
}

/**
 * Part-to-whole ring (Skymetrics' "Traffic by source"): ≤5 parts in fixed colour order with 2px surface gaps, the
 * total in the middle, and a legend that prints every count and share (so nothing depends on colour or hover).
 * parts: [{ key, label, value }]
 */
export function Donut({ parts, totalLabel, size = 168 }) {
  const whole = parts.reduce((a, p) => a + p.value, 0);
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = whole > 0 && parts.filter((p) => p.value > 0).length > 1 ? 4 : 0; // px of ring between segments
  let offset = 0;
  const arcs = parts.map((p, i) => {
    const len = whole > 0 ? (p.value / whole) * c : 0;
    const arc = {
      ...p,
      color: SERIES[i % SERIES.length],
      dash: Math.max(0, len - gap),
      offset,
      share: pct(p.value, whole),
    };
    offset += len;
    return arc;
  });
  return (
    <figure className="flex flex-col items-center gap-5 sm:flex-row sm:items-center xl:flex-col 2xl:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f0ec" strokeWidth={stroke} />
          {arcs.map((a) =>
            a.dash > 0 ? (
              <circle
                key={a.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={stroke}
                strokeDasharray={`${a.dash} ${c - a.dash}`}
                strokeDashoffset={-a.offset}
              >
                <title>{`${a.label}: ${formatCount(a.value)} (${formatPercent(a.share)})`}</title>
              </circle>
            ) : null,
          )}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-2xl font-semibold tracking-tight text-ink">{formatCount(whole)}</span>
          <span className="text-xs text-stone-500">{totalLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2.5 text-sm">
        {arcs.map((a) => (
          <li key={a.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-stone-600">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: a.color }} />
              <span className="truncate">{a.label}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-medium text-ink">{formatCount(a.value)}</span>
              <span className="ml-1.5 text-xs text-stone-400">{formatPercent(a.share, 0)}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
