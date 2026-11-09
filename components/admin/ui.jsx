// Admin design system (Skymetrics-style): page title, white cards with small sans titles, table header style.
// Server-safe; shared by the overview, Users and user pages.
import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';

/** Page title (sans, like the overview) with an optional back link, description and actions on the right. */
export function PageTitle({ title, description, actions, back }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-ink">
          <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** A white card with a small sans title, an optional subtitle, and a quiet link or any action on the right. */
export function Card({ title, sub, href, linkLabel = 'View all', action, id, className = '', bodyClassName = 'p-5 pt-4', children }) {
  return (
    <section id={id} className={`flex min-w-0 scroll-mt-24 flex-col rounded-2xl border border-stone-200 bg-white ${className}`}>
      {(title || action || href) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
          </div>
          {action}
          {href && (
            <Link
              href={href}
              prefetch={false}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:border-stone-300 hover:text-ink"
            >
              {linkLabel}
              <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
            </Link>
          )}
        </header>
      )}
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** Soft grey, rounded table header row (inside a card). */
export const TABLE_HEAD =
  'bg-stone-50 text-left text-xs font-medium text-stone-500 [&_th]:py-2.5 [&_th:first-child]:rounded-l-lg [&_th:last-child]:rounded-r-lg';

/** Label / value rows. */
export function DetailList({ rows }) {
  return (
    <dl className="divide-y divide-stone-100 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-stone-500">{k}</dt>
          <dd className="min-w-0 text-right font-medium break-words text-ink [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Initial in a soft circle. */
export function Avatar({ name, size = 'md', tone = 'brand' }) {
  const sizes = { sm: 'size-7 text-xs', md: 'size-9 text-sm', lg: 'size-14 text-xl' };
  const tones = { brand: 'bg-brand-100 text-brand-900', stone: 'bg-stone-100 text-stone-600', ink: 'bg-ink text-brand-400' };
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full font-semibold ${sizes[size]} ${tones[tone]}`}>
      {(name || '?').trim().charAt(0).toUpperCase()}
    </span>
  );
}
