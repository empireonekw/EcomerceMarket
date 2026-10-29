// Small server-safe UI primitives shared by the admin and seller dashboards.

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-3xl font-[420] tracking-[-0.02em] text-ink sm:text-[2.5rem] sm:leading-[1.1]">{title}</h1>
        {description && <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Metric tile. `icon` is a lucide-react component. `featured`: the page's key number, on a solid brand card. */
export function StatCard({ label, value, sub, icon: Icon, tone = 'neutral', featured = false }) {
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
          <p className="text-sm font-medium text-ink/70">{label}</p>
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
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-500">{label}</p>
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
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_TONES[status] ?? STATUS_TONES.cancelled}`}>
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
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>;
}

export function ProviderBadge({ provider }) {
  if (!provider || provider === 'stripe') return null;
  return (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-stone-500">
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
