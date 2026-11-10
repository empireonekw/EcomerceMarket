import Link from 'next/link';
import { ArrowUpRight, BadgeCheck, Banknote, Clock, Inbox, Info, Mail, PackageCheck, Store, UserX } from 'lucide-react';
import { RoleBadge, StatusBadge, formatDateTime } from '@/components/dashboard/ui';
import { Card, TABLE_HEAD } from '@/components/admin/ui';
import Thumb from '@/components/dashboard/Thumb';
import KpiCard, { StatStrip } from '@/components/admin/analytics/KpiCard';
import RangeShell from '@/components/admin/analytics/RangeShell';
import TrendChart from '@/components/admin/analytics/TrendChart';
import { BarList, Donut, SegmentedBar, StackedColumns } from '@/components/admin/analytics/Bars';
import { formatCount, formatMoney, formatPercent } from '@/components/admin/analytics/format';
import { getAdminAnalytics, RANGE_PRESETS } from '@/lib/data/admin-analytics';
import { statsDay } from '@/lib/listing-stats';
import { countryName, DEVICES, PAGE_SECTIONS } from '@/lib/site-stats';
import { formatPrice } from '@/lib/utils';
import { siteConfig } from '@/lib/site';

// `absolute`: the admin layout's title template only applies to child segments, not this same-segment page.
export const metadata = {
  title: { absolute: `Dashboard · ${siteConfig.name} Admin` },
};

const SOURCE_GROUPS = [
  { key: 'direct', label: 'Direct', from: ['direct'] },
  { key: 'search', label: 'Search engines', from: ['search_engine'] },
  {
    key: 'social',
    label: 'Social media',
    from: ['facebook', 'instagram', 'pinterest', 'twitter', 'tumblr'],
  },
  { key: 'internal', label: 'Within Sellpify', from: ['sellpify'] },
  { key: 'other', label: 'Other sites', from: ['other'] },
];

export default async function AdminDashboardPage({ searchParams }) {
  const data = await getAdminAnalytics(await searchParams);
  const { range, kpis, series, health } = data;
  const compare = range.compareLabel;
  const k = (key, kind) => ({
    value: kpis[key].value,
    previous: kpis[key].previous,
    kind,
    compareLabel: compare,
  });

  const sources = SOURCE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    value: g.from.reduce((a, s) => a + (data.traffic.sources[s] ?? 0), 0),
  }));
  const devices = DEVICES.map((d) => ({
    ...d,
    value: data.devices[d.key] ?? 0,
  }));
  const sections = PAGE_SECTIONS.map((s) => ({
    key: s.key,
    label: s.label,
    value: data.sections[s.key] ?? 0,
  }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const trackingStarted = range.tracking.since;
  const trackingGap = !trackingStarted || trackingStarted > range.from;

  const attention = [
    {
      key: 'pending',
      label: 'Listings awaiting approval',
      value: health.pendingListings,
      href: '/admin/products?status=pending',
      icon: PackageCheck,
    },
    {
      key: 'setup',
      label: 'Sellers stuck in shop setup',
      value: health.setupPending,
      href: '/admin/users?status=setup',
      icon: Store,
    },
    {
      key: 'shoppers',
      label: 'Shoppers stuck opening a shop',
      value: health.stuckShoppers,
      href: '/admin/users?status=wizard',
      icon: UserX,
    },
    {
      key: 'payout',
      label: 'Shops without payout details',
      value: health.payoutMissing,
      href: '/admin/users?status=payout',
      icon: Banknote,
    },
    {
      key: 'ids',
      label: 'IDs to review',
      value: health.idsToReview,
      href: '/admin/users?role=seller&verification=pending',
      icon: BadgeCheck,
    },
    {
      key: 'payouts',
      label: 'Payout requests',
      value: health.payoutRequests,
      href: '/admin/payouts',
      icon: Clock,
    },
    {
      key: 'chats',
      label: 'Open support chats',
      value: health.openChats,
      href: '/admin/messages',
      icon: Inbox,
    },
    {
      key: 'contact',
      label: 'New contact messages',
      value: health.newContact,
      href: '/admin/messages?view=contact',
      icon: Mail,
    },
  ];

  return (
    <RangeShell
      title="Overview"
      description="Visitors, sign-ups, shops, listings and sales on Sellpify."
      presets={RANGE_PRESETS}
      range={range}
      today={statsDay()}
      actions={
        <a href="/" target="_blank" rel="noopener" className="btn btn-md btn-dark">
          View live site
          <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
        </a>
      }
    >
      {trackingGap && (
        <p role="status" className="mb-4 flex items-center gap-2 text-xs text-stone-500">
          <Info size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
          {trackingStarted
            ? `Visitor tracking started on ${new Date(`${trackingStarted}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}: visitors and page views before then show as 0.`
            : 'Visitor tracking starts with this update: visitors and page views fill in from today.'}
        </p>
      )}

      {/* ---------- Headline numbers: honey and black bookend the row ---------- */}
      <section aria-label="Headline numbers" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Revenue" {...k('revenue', 'money')} href="/admin/orders" tone="brand" />
        <KpiCard label="Paid orders" {...k('orders', 'count')} href="/admin/orders" />
        <KpiCard label="Visitors" {...k('visitors', 'count')} />
        <KpiCard label="New sign-ups" {...k('signups', 'count')} href="/admin/users" tone="ink" />
      </section>

      <div className="mt-4">
        <StatStrip
          items={[
            {
              label: 'Shops opened',
              value: kpis.shops.value,
              previous: kpis.shops.previous,
              kind: 'count',
            },
            {
              label: 'New listings',
              value: kpis.listings.value,
              previous: kpis.listings.previous,
              kind: 'count',
            },
            {
              label: 'Product views',
              value: kpis.productViews.value,
              previous: kpis.productViews.previous,
              kind: 'count',
            },
            {
              label: 'Page views',
              value: kpis.views.value,
              previous: kpis.views.previous,
              kind: 'count',
            },
            {
              label: 'Conversion rate',
              value: kpis.conversion.value,
              previous: kpis.conversion.previous,
              kind: 'percent',
            },
            {
              label: 'Avg order value',
              value: kpis.aov.value,
              previous: kpis.aov.previous,
              kind: 'money',
            },
          ]}
        />
      </div>

      {/* ---------- Over time + traffic ---------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="Performance over time" className="min-w-0 rounded-2xl border border-stone-200 bg-white">
          <TrendChart
            labels={range.buckets.map((b) => b.label)}
            prevLabels={range.prevBuckets.map((b) => b.label)}
            compareLabel={compare}
            metrics={[
              {
                key: 'revenue',
                label: 'Revenue',
                kind: 'money',
                ...series.revenue,
              },
              {
                key: 'orders',
                label: 'Orders',
                kind: 'count',
                ...series.orders,
              },
              {
                key: 'visitors',
                label: 'Visitors',
                kind: 'count',
                ...series.visitors,
              },
              {
                key: 'views',
                label: 'Page views',
                kind: 'count',
                ...series.views,
              },
              {
                key: 'signups',
                label: 'Sign-ups',
                kind: 'count',
                ...series.signups,
              },
              {
                key: 'shops',
                label: 'Shops opened',
                kind: 'count',
                ...series.shops,
              },
              {
                key: 'productViews',
                label: 'Product views',
                kind: 'count',
                ...series.productViews,
              },
              {
                key: 'listings',
                label: 'New listings',
                kind: 'count',
                ...series.listings,
              },
            ]}
          />
        </section>
        <Card
          title="Traffic by source"
          sub={data.traffic.source === 'site' ? 'Where visitors came from' : 'Product-page visits, until visitor data fills in'}
        >
          <Donut parts={sources} totalLabel={data.traffic.source === 'site' ? 'Total visits' : 'Product visits'} />
        </Card>
      </div>

      {/* ---------- Orders + products ---------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Recent orders" href="/admin/orders">
          {data.recentOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">No orders yet.</p>
          ) : (
            <table className="w-full table-fixed text-sm">
              <thead className={TABLE_HEAD}>
                <tr>
                  <th className="w-24 pl-3">Order</th>
                  <th>Customer</th>
                  <th className="w-28 max-sm:hidden">Date</th>
                  <th className="w-28 pr-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.recentOrders.map((o) => (
                  <tr key={o._id}>
                    <td className="py-3 pl-3 font-medium tabular-nums text-stone-600">
                      <Link href={`/admin/orders?q=${o._id}`} prefetch={false} className="hover:text-ink">
                        #{String(o._id).slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-900"
                        >
                          {o.buyerEmail.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate text-ink">{o.buyerEmail}</span>
                      </span>
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-stone-500 max-sm:hidden">{formatDateTime(o.createdAt).date}</td>
                    <td className="py-3 pr-3 text-right whitespace-nowrap">
                      <span className="font-semibold tabular-nums text-ink">{formatPrice(o.totalAmount, o.currency)}</span>
                      <span className="mt-0.5 block">
                        <StatusBadge status={o.status} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Top products" sub="By sales in this period" href="/admin/products" linkLabel="Products">
          {data.topProducts.length === 0 ? (
            <ProductTable rows={data.mostViewed} metric="views" note="No sales in this period yet. Most viewed listings instead:" />
          ) : (
            <ProductTable rows={data.topProducts} metric="sold" />
          )}
        </Card>
      </div>

      {/* ---------- Funnels + attention ---------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Shopping funnel" sub="From a visit to a paid order">
          {/* Until visitor tracking covers the whole period, the funnel starts at product views. */}
          <BarList rows={trackingGap ? data.funnel.slice(1) : data.funnel} steps emptyText="No visits or orders in this period yet." />
        </Card>
        <Card title="Seller journey" sub="People who signed up to sell in this period">
          <BarList rows={data.sellerFunnel} steps color="#2a78d6" emptyText="Nobody signed up to sell in this period." />
        </Card>
        <Card title="Needs attention" sub="Right now, whatever the period" bodyClassName="px-3 pb-3 pt-2" className="lg:col-span-2 xl:col-span-1">
          <ul>
            {attention.map(({ key, label, value, href, icon: Icon }) => (
              <li key={key}>
                <Link href={href} prefetch={false} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-stone-50">
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-stone-400" />
                  <span className="min-w-0 flex-1 truncate text-stone-700">{label}</span>
                  <span
                    className={`min-w-7 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums ${
                      value > 0 ? 'bg-brand-500 text-ink' : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    {formatCount(value)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ---------- Sign-ups + devices ---------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="New sign-ups" sub={`${formatCount(kpis.signups.value)} accounts in this period`} href="/admin/users" linkLabel="Users">
          <StackedColumns
            buckets={range.buckets}
            series={[
              {
                key: 'customers',
                label: 'Shoppers',
                values: series.customers.current,
              },
              {
                key: 'sellers',
                label: 'Sellers',
                values: series.sellers.current,
              },
            ]}
          />
        </Card>
        <Card title="Devices" sub={`${formatCount(data.newVisitors)} first-time visitors`}>
          <SegmentedBar parts={devices} label="Visitors by device" />
        </Card>
      </div>

      {/* ---------- Where ---------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Visitors by country">
          <BarList
            rows={data.countries.slice(0, 6).map((c) => ({
              key: c.code,
              label: countryName(c.code),
              value: c.count,
            }))}
            emptyText="No visitor data for this period yet."
          />
        </Card>
        <Card title="Sellers by country" sub="Every open shop">
          <BarList
            rows={data.sellersByCountry.slice(0, 6).map((c) => ({
              key: c.code,
              label: countryName(c.code),
              value: c.count,
            }))}
            color="#2a78d6"
            emptyText="No open shops yet."
          />
        </Card>
        <Card title="Most visited pages" sub="Page views by kind of page">
          <BarList rows={sections.slice(0, 6)} emptyText="No page views for this period yet." />
        </Card>
      </div>

      {/* ---------- Shops, categories, people ---------- */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Top shops" sub="By sales in this period" href="/admin/users?role=seller" linkLabel="Sellers">
          <BarList
            rows={data.topSellers.map((s) => ({
              key: String(s.id),
              label: s.name,
              value: s.gross,
              sub: `${formatCount(s.sales)} sale${s.sales === 1 ? '' : 's'}`,
            }))}
            kind="money"
            emptyText="No shop sales in this period yet."
          />
        </Card>
        <Card
          title="New listings by category"
          sub={`${formatCount(kpis.listings.value)} added in this period`}
          href="/admin/categories"
          linkLabel="Categories"
        >
          <BarList
            rows={data.categories.slice(0, 6).map((c) => ({
              key: String(c.id),
              label: c.name,
              value: c.count,
            }))}
            color="#2a78d6"
            emptyText="No new listings in this period."
          />
        </Card>
        <Card title="Latest sign-ups" href="/admin/users" linkLabel="Users" bodyClassName="px-3 pb-3 pt-2">
          <ul>
            {data.recentSignups.slice(0, 6).map((u) => (
              <li key={u._id}>
                <Link href={`/admin/users/${u._id}`} prefetch={false} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-stone-50">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600"
                  >
                    {(u.name || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{u.seller?.storeName || u.name}</span>
                    <span className="block truncate text-xs text-stone-500">
                      {formatDateTime(u.createdAt).date}, {formatDateTime(u.createdAt).time}
                    </span>
                  </span>
                  <RoleBadge role={u.role} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </RangeShell>
  );
}

/** Products with a thumbnail and one number (units sold, or views), Skymetrics' "Top products" table. */
function ProductTable({ rows, metric, note }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-stone-500">No sales or product views in this period yet.</p>;
  return (
    <>
      {note && <p className="mb-3 text-xs text-stone-500">{note}</p>}
      <table className="w-full table-fixed text-sm">
        <thead className={TABLE_HEAD}>
          <tr>
            <th className="pl-3">Product</th>
            <th className="w-20 text-right">{metric === 'sold' ? 'Units sold' : 'Views'}</th>
            <th className="w-28 pr-3 text-right">{metric === 'sold' ? 'Revenue' : 'Add to cart'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="py-2.5 pr-3 pl-3">
                <Link href={`/admin/products/${p.id}/edit`} prefetch={false} className="flex min-w-0 items-center gap-3 hover:text-brand-700">
                  <Thumb src={p.coverImage} sizes="36px" className="size-9" />
                  <span className="truncate font-medium text-ink">{p.title}</span>
                </Link>
              </td>
              <td className="py-2.5 text-right tabular-nums text-stone-600">{formatCount(metric === 'sold' ? p.sold : p.views)}</td>
              <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-ink">
                {metric === 'sold' ? formatMoney(p.gross) : `${formatCount(p.carts)}${p.views ? ` (${formatPercent(p.carts / p.views, 0)})` : ''}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
