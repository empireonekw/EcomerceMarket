// Small server-safe UI primitives shared by the admin and seller dashboards.
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-3xl font-[420] tracking-tight text-ink sm:text-4xl sm:leading-display">{title}</h1>
        {description && <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Metric tile. `icon` is a lucide-react component. `featured`: the page's key number, on a solid brand card.
 * `href`: the whole tile opens the page behind the number (with a hover lift and an arrow).
 */
export function StatCard({ href, ...props }) {
  if (!href) return <StatCardBody {...props} />;
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={`${props.label}: ${props.value}. Open`}
      className="group block rounded-2xl transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:-translate-y-0.5 motion-reduce:transition-none"
    >
      <StatCardBody {...props} linked />
    </Link>
  );
}

function StatCardBody({ label, value, sub, icon: Icon, tone = 'neutral', featured = false, linked = false }) {
  const arrow = linked && (
    <ArrowUpRight
      size={16}
      strokeWidth={2}
      aria-hidden="true"
      className="opacity-0 transition-[opacity,translate] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
    />
  );
  const tones = {
    neutral: 'bg-stone-100 text-stone-700',
    positive: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    info: 'bg-sky-50 text-sky-700',
    brand: 'bg-brand-50 text-brand-700',
  };
  if (featured) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-brand-500 p-5 text-ink shadow-[0_20px_40px_-22px_rgba(220,154,47,0.9)]">
        <span aria-hidden="true" className="absolute -top-10 -right-10 size-36 rounded-full bg-white/25" />
        <span aria-hidden="true" className="absolute -right-4 -bottom-16 size-32 rounded-full bg-white/15" />
        <div className="relative flex items-center justify-between">
          <p className="flex items-center gap-1 text-sm font-medium text-ink/70">
            {label}
            {arrow}
          </p>
          {Icon && (
            <span className="grid size-9 place-items-center rounded-xl bg-ink text-brand-500">
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
          )}
        </div>
        <p className="headline relative mt-3 text-4xl tabular-nums">{value}</p>
        {sub && <p className="relative mt-1 text-sm text-ink/70">{sub}</p>}
      </div>
    );
  }
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white p-5 ${linked ? 'transition-colors group-hover:border-stone-300' : ''}`}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-sm font-medium text-stone-500">
          {label}
          {arrow}
        </p>
        {Icon && (
          <span className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}>
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="headline mt-3 text-4xl tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-sm text-stone-500">{sub}</p>}
    </div>
  );
}

const STATUS_TONES = {
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  requested: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  cancelled: 'bg-stone-100 text-stone-600 ring-stone-500/20',
};

/** Order, product-moderation and payout statuses share one badge. */
export function StatusBadge({ status, label }) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_TONES[status] ?? STATUS_TONES.cancelled}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label ?? status}
    </span>
  );
}

const ROLE_STYLES = {
  admin: { label: 'Admin', className: 'bg-black text-white' },
  seller: { label: 'Seller', className: 'bg-brand-50 text-brand-700' },
  customer: { label: 'Customer', className: 'bg-stone-100 text-stone-700' },
};

export function RoleBadge({ role }) {
  const style = ROLE_STYLES[role] ?? ROLE_STYLES.customer;
  return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>;
}

export function ProviderBadge({ provider }) {
  if (!provider || provider === 'stripe') return null;
  return (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-stone-500">
      {provider}
    </span>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-stone-500">{children}</div>}
    </div>
  );
}

/** Bordered white panel with an optional header row. */
export function Panel({ title, action, children, id }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-stone-200 bg-white">
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4">
          {title && <h2 className="headline text-xl">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export const buttonClasses = {
  primary:
    'btn btn-md btn-dark',
  secondary:
    'btn btn-md btn-outline',
};

export function formatDateTime(value) {
  const d = new Date(value);
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}
