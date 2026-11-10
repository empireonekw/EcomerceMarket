import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { change, formatPercent, formatValue } from './format';

const PILL = {
  light: {
    good: 'bg-emerald-50 text-emerald-700',
    bad: 'bg-red-50 text-red-700',
    flat: 'bg-stone-100 text-stone-600',
  },
  brand: {
    good: 'bg-white/70 text-emerald-800',
    bad: 'bg-white/70 text-red-700',
    flat: 'bg-white/60 text-ink',
  },
  ink: {
    good: 'bg-emerald-400/15 text-emerald-300',
    bad: 'bg-red-400/15 text-red-300',
    flat: 'bg-white/10 text-white/70',
  },
};

/** Signed change pill: green when the move is good, red when it's bad (with an arrow, never colour alone). */
export function DeltaPill({ value, previous, downIsGood = false, tone = 'light' }) {
  const styles = PILL[tone];
  const c = change(value, previous);
  if (!c) return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles.flat}`}>No data</span>;
  if (c.ratio === null) return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles.good}`}>New</span>;
  const good = c.direction === 'flat' ? null : (c.direction === 'up') !== downIsGood;
  const Icon = c.direction === 'up' ? ArrowUpRight : c.direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${good === null ? styles.flat : good ? styles.good : styles.bad}`}
    >
      {c.ratio > 0 ? '+' : ''}
      {formatPercent(c.ratio)}
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      <span className="sr-only">{good === null ? ' (no change)' : good ? ' (better)' : ' (worse)'}</span>
    </span>
  );
}

const CARD = {
  light: 'border border-stone-200 bg-white text-ink group-hover:border-stone-300',
  brand: 'bg-brand-500 text-ink shadow-[0_18px_40px_-24px_rgba(201,133,0,0.9)]',
  ink: 'bg-ink text-white shadow-[0_18px_40px_-24px_rgba(0,0,0,0.6)]',
};
const MUTED = {
  light: 'text-stone-500',
  brand: 'text-ink/65',
  ink: 'text-white/55',
};

/**
 * A metric tile: label (and an optional badge) on top, the value, a quiet line under it. `tone`: light (white card) |
 * brand (solid honey) | ink (solid black). `href` makes the whole tile a link. Used on every admin page.
 */
export function MetricCard({ label, value, sub, badge, tone = 'light', href }) {
  const body = (
    <div className={`relative h-full overflow-hidden rounded-2xl p-4 transition-colors sm:p-5 ${CARD[tone]}`}>
      {tone !== 'light' && (
        <span
          aria-hidden="true"
          className={`absolute -top-12 -right-12 size-36 rounded-full ${tone === 'brand' ? 'bg-white/20' : 'bg-white/[0.04]'}`}
        />
      )}
      <div className="relative flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <p className={`flex items-center gap-1 text-sm font-medium ${tone === 'light' ? 'text-ink' : ''}`}>
          {label}
          {href && (
            <ArrowUpRight
              size={14}
              strokeWidth={2}
              aria-hidden="true"
              className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          )}
        </p>
        {badge}
      </div>
      <p className="relative mt-3 text-2xl leading-none font-semibold tracking-tight sm:mt-4 sm:text-[1.75rem]">{value}</p>
      {sub && <p className={`relative mt-2 text-xs ${MUTED[tone]}`}>{sub}</p>}
    </div>
  );
  if (!href) return body;
  return (
    <Link
      href={href}
      prefetch={false}
      className="group block rounded-2xl transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
    >
      {body}
    </Link>
  );
}

/**
 * One headline metric with its change against the previous period (the analytics overview).
 * `kind`: money | count | percent.
 */
export default function KpiCard({ label, value, previous, kind = 'count', compareLabel, href, downIsGood, tone = 'light', note }) {
  return (
    <MetricCard
      label={label}
      value={formatValue(value, kind)}
      sub={note ?? `vs ${formatValue(previous, kind)} in the ${compareLabel}`}
      badge={<DeltaPill value={value} previous={previous} downIsGood={downIsGood} tone={tone} />}
      tone={tone}
      href={href}
    />
  );
}

/** A row of secondary numbers in one card, split by hairlines (no extra boxes). */
export function StatStrip({ items }) {
  return (
    // A 1px grid gap over a hairline-grey background draws the dividers at every width.
    <section
      aria-label="More numbers"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 sm:grid-cols-3 xl:grid-cols-6"
    >
      {items.map((s) => (
        <div key={s.label} className="bg-white px-5 py-4">
          <p className="text-xs font-medium text-stone-500">{s.label}</p>
          <p className="mt-1.5 flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-ink">{formatValue(s.value, s.kind)}</span>
            {s.previous !== undefined && <DeltaPill value={s.value} previous={s.previous} />}
          </p>
        </div>
      ))}
    </section>
  );
}
