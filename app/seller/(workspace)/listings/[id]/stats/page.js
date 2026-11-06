import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Clock, ExternalLink } from 'lucide-react';
import Link from '@/components/PrefetchLink';
import StatsChart, { Donut } from '@/components/seller/StatsChart';
import { requireSellerStore } from '@/lib/auth';
import { getListingStats } from '@/lib/data/listing-stats';
import { STATS_RANGES } from '@/lib/listing-stats';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'Listing stats' };

const COLORS = { visits: '#e8805a', orders: '#3db5e6', revenue: '#6cc9b4', carts: '#d4572b' };
const SOCIAL = [
  { key: 'facebook', label: 'Facebook', color: '#4f46a5' },
  { key: 'tumblr', label: 'Tumblr', color: '#0ea5c9' },
  { key: 'twitter', label: 'Twitter / X', color: '#dc2626' },
  { key: 'pinterest', label: 'Pinterest', color: '#5bbfae' },
  { key: 'instagram', label: 'Instagram', color: '#a3195b' },
];

const fmtDay = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });

function Updated() {
  return (
    <p className="flex items-center gap-1 text-xs text-stone-500">
      <Clock size={12} strokeWidth={2} aria-hidden="true" />
      Just now
    </p>
  );
}

/** One of the three headline numbers with its small chart (Visits, Items sold, Revenue). */
function Metric({ label, value, values, days, color, legend }) {
  return (
    <div className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-ink underline decoration-dotted underline-offset-4">{label}</p>
        <Updated />
      </div>
      <p className="mt-2 text-4xl font-semibold tabular-nums text-ink">{value}</p>
      <div className="mt-3">
        <StatsChart compact height={130} days={days} series={[{ values, color, label, area: true }]} />
      </div>
      <p className="mt-auto flex items-center justify-between border-t border-stone-100 pt-3 text-sm text-stone-600">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: color }} />
          Sellpify
        </span>
        {legend}
      </p>
    </div>
  );
}

/** A section in Etsy's layout: title + note on the left, the content card on the right. */
function Section({ title, note, children }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <div className="mt-1">
          <Updated />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">{note}</p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5">{children}</div>
    </section>
  );
}

/**
 * Seller → Listings → ☰ → View stats: one listing's visits, sales and revenue over 7 / 30 / 90 days, how visits turn
 * into orders, the Sellpify searches and social sites that sent buyers, and add-to-carts (lib/data/listing-stats.js).
 */
export default async function ListingStatsPage({ params, searchParams }) {
  const seller = await requireSellerStore();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const days = STATS_RANGES.includes(Number(sp.range)) ? Number(sp.range) : 30;
  const data = await getListingStats(seller.id, id, days);
  if (!data) notFound();

  const { product, series, totals, range } = data;
  const money = (cents) => formatPrice(cents, product.currency || 'USD');
  const live = product.status === 'approved' && product.isPublished;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <Link href="/seller/listings" className="text-sm text-stone-500 hover:text-ink">
          ← Listings
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.01em] text-ink">Listing stats</h1>
        <nav aria-label="Date range" className="mt-4 flex flex-wrap items-center gap-2">
          {STATS_RANGES.map((r) => (
            <Link
              key={r}
              href={`/seller/listings/${id}/stats${r === 30 ? '' : `?range=${r}`}`}
              aria-current={r === days ? 'page' : undefined}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${r === days ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-ink'}`}
            >
              Last {r} days
            </Link>
          ))}
          <span className="ml-1 text-sm text-stone-500">
            {fmtDay(range[0])} – {fmtDay(range[range.length - 1])}
          </span>
        </nav>
      </div>

      {/* ---------- The listing ---------- */}
      <section className="flex flex-col gap-5 rounded-2xl border border-stone-200 bg-white p-5 sm:flex-row">
        <div className="relative aspect-[5/4] w-full shrink-0 overflow-hidden rounded-xl bg-stone-100 sm:w-56">
          {product.coverImage && <Image src={product.coverImage} alt="" fill sizes="224px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h2 className="text-lg font-semibold leading-snug text-ink">{product.title}</h2>
            {live && (
              <a href={`/products/${product.slug}`} target="_blank" rel="noopener" className="btn btn-md btn-outline shrink-0">
                View item
                <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
              </a>
            )}
          </div>
          <dl className="mt-4 grid gap-2 border-b border-stone-100 pb-4 text-[15px] text-stone-700 sm:grid-cols-2">
            <div>
              <dt className="inline text-stone-500">Price: </dt>
              <dd className="inline tabular-nums">{money(product.price)}</dd>
            </div>
            <div>
              <dt className="inline text-stone-500">Status: </dt>
              <dd className="inline">{product.statusLabel}</dd>
            </div>
          </dl>
          <div className="mt-4 rounded-xl border border-stone-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Improvement suggestions</p>
              <Link href={`/seller/listings/${id}/edit`} className="text-sm font-medium text-ink underline underline-offset-2">
                Edit listing
              </Link>
            </div>
            {data.suggestions.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-600 marker:text-stone-400">
                {data.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-600">Nice work: this listing has everything buyers look for.</p>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Headline numbers ---------- */}
      <section className="grid divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white md:grid-cols-3 md:divide-x md:divide-y-0">
        <Metric label="Visits" value={totals.visits} values={series.visits} days={range} color={COLORS.visits} legend={`${totals.visits} visit${totals.visits === 1 ? '' : 's'}`} />
        <Metric label="Items sold" value={totals.orders} values={series.orders} days={range} color={COLORS.orders} legend={`${totals.orders} item${totals.orders === 1 ? '' : 's'} sold`} />
        <Metric label="Revenue" value={money(totals.revenue)} values={series.revenue} days={range} color={COLORS.revenue} legend={money(totals.revenue)} />
      </section>

      {/* ---------- Explore your data: visits vs orders ---------- */}
      <Section title="Explore your data" note="How many visits result in an order? Look for trends and relationships between your numbers.">
        <div className="flex flex-wrap gap-3">
          {[
            ['Visits', totals.visits, COLORS.visits],
            ['Orders', totals.orders, COLORS.orders],
          ].map(([label, value, color]) => (
            <div key={label} className="min-w-40 rounded-2xl border border-stone-300 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
                {label}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">{value}</p>
            </div>
          ))}
          <p className="ml-auto self-end text-sm text-stone-500">
            Conversion: {totals.visits ? `${((totals.orders / totals.visits) * 100).toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="mt-5">
          <StatsChart
            dualAxis
            height={280}
            days={range}
            series={[
              { values: series.visits, color: COLORS.visits, label: 'Visits' },
              { values: series.orders, color: COLORS.orders, label: 'Orders' },
            ]}
          />
        </div>
      </Section>

      {/* ---------- Search terms ---------- */}
      <Section title="Search terms" note="What people searched for on Sellpify before visiting this listing. Use these as ideas for your listing tags.">
        <div className="rounded-lg bg-stone-100 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-stone-600">Search terms</div>
        {data.searchTerms.length ? (
          <ul className="divide-y divide-stone-100">
            {data.searchTerms.map((t) => (
              <li key={t.term} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span className="text-ink">{t.term}</span>
                <span className="tabular-nums text-stone-500">
                  {t.count} visit{t.count === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-16 text-center text-stone-500">No data available</p>
        )}
      </Section>

      {/* ---------- Social media ---------- */}
      <Section title="Social media" note="Visits that came from social media. Share your listing regularly to bring in more buyers.">
        <div className="flex flex-col items-center gap-8 sm:flex-row">
          <Donut items={SOCIAL.map((s) => ({ label: s.label, value: data.sources[s.key] ?? 0, color: s.color }))} />
          <ul className="w-full flex-1 divide-y divide-stone-100">
            {SOCIAL.map((s) => {
              const total = SOCIAL.reduce((a, x) => a + (data.sources[x.key] ?? 0), 0);
              const v = data.sources[s.key] ?? 0;
              return (
                <li key={s.key} className="flex items-center justify-between py-3 text-[15px]">
                  <span className="flex items-center gap-3 text-ink">
                    <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="tabular-nums text-stone-700">
                    {total ? Math.round((v / total) * 100) : 0}% <span className="text-stone-400">({v})</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* ---------- Added to cart (instead of Etsy's favourites) ---------- */}
      <Section title="Added to cart" note="How often buyers added this listing to their cart over time.">
        <p className="text-3xl font-semibold tabular-nums text-ink">{totals.carts}</p>
        <div className="mt-3">
          <StatsChart height={240} days={range} series={[{ values: series.carts, color: COLORS.carts, label: 'Added to cart' }]} />
        </div>
      </Section>
    </div>
  );
}
