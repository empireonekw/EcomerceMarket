import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, DollarSign, Landmark, Package, Receipt, Store, Users } from 'lucide-react';
import { PageHeader, StatCard, StatusBadge, ProviderBadge, EmptyState, buttonClasses, formatDateTime } from '@/components/dashboard/ui';
import { getDashboardStats } from '@/lib/data/admin';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { siteConfig } from '@/lib/site';

// `absolute`: the admin layout's title template only applies to child segments, not this same-segment page.
export const metadata = { title: { absolute: `Dashboard · ${siteConfig.name} Admin` } };

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  const usd = (cents) => formatPrice(cents, 'USD');

  return (
    <>
      <PageHeader
        title="Dashboard Overview"
        description="Users, sellers, sales and catalog at a glance."
        actions={
          <Link href="/admin/products/add" className={buttonClasses.primary}>
            + Add product
          </Link>
        }
      />

      <section aria-label="Platform overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Platform Revenue"
          value={usd(stats.revenue.total)}
          sub={
            stats.revenue.demo > 0
              ? `${usd(stats.revenue.demo)} from demo orders · ${usd(stats.revenue.last30d)} last 30d`
              : `${usd(stats.revenue.last30d)} in the last 30 days`
          }
          icon={DollarSign}
          tone="positive"
        />
        <StatCard
          label="Total Users"
          value={stats.users.total.toLocaleString('en-US')}
          sub={`${stats.users.customers.toLocaleString('en-US')} customers`}
          icon={Users}
          tone="info"
        />
        <StatCard
          label="Total Sellers"
          value={stats.users.sellers.toLocaleString('en-US')}
          sub={stats.users.sellersWithoutShop ? `${stats.users.sellersWithoutShop} haven’t set up a shop` : 'All shops set up'}
          icon={Store}
          tone={stats.users.sellersWithoutShop ? 'warning' : 'positive'}
        />
        <StatCard
          label="Total Products"
          value={stats.products.total.toLocaleString('en-US')}
          sub={
            stats.products.pendingReview
              ? `${stats.products.active} live · ${stats.products.pendingReview} awaiting approval`
              : `${stats.products.active} live${stats.products.drafts ? ` · ${stats.products.drafts} not live` : ''}`
          }
          icon={Package}
          tone={stats.products.pendingReview ? 'warning' : 'info'}
        />
      </section>

      <section aria-label="Orders and earnings" className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total Orders"
          value={stats.orders.total.toLocaleString('en-US')}
          sub={`${stats.orders.last30d} in the last 30 days`}
          icon={Receipt}
        />
        <StatCard
          label="Your Earnings"
          value={usd(stats.platform.commission)}
          sub={`Commission + platform-owned sales, from ${usd(stats.platform.salesGross)} in product sales`}
          icon={Landmark}
          tone="positive"
        />
        <a
          href="/"
          target="_blank"
          rel="noopener"
          className="group flex flex-col justify-between rounded-2xl bg-ink p-5 text-white transition-colors hover:bg-stone-800"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-stone-400">Storefront</p>
            <ArrowUpRight size={20} strokeWidth={1.75} aria-hidden="true" className="text-stone-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <div>
            <p className="mt-3 text-xl font-medium">Preview live site</p>
            <p className="mt-1 text-sm text-stone-400">Opens the store in a new tab</p>
          </div>
        </a>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* Recent orders */}
        <section className="rounded-2xl border border-stone-200 bg-white" aria-labelledby="recent-orders">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <h2 id="recent-orders" className="headline text-xl">
              Recent orders
            </h2>
            <Link href="/admin/orders" className="text-sm font-medium text-stone-500 hover:text-ink">
              View all →
            </Link>
          </div>
          {stats.recentOrders.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No orders yet">Orders will appear here as soon as customers check out.</EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {stats.recentOrders.map((o) => {
                const { date, time } = formatDateTime(o.createdAt);
                return (
                  <li key={o._id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{o.buyerEmail}</p>
                      <p className="truncate text-xs text-stone-500">
                        {o.items.map((i) => i.title).join(', ')}
                      </p>
                    </div>
                    <div className="hidden text-right text-xs text-stone-500 sm:block">
                      {date}
                      <br />
                      {time}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-medium tabular-nums">{formatPrice(o.totalAmount, o.currency)}</span>
                      <span className="flex items-center gap-1">
                        <ProviderBadge provider={o.paymentProvider} />
                        <StatusBadge status={o.status} />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Top sellers */}
        <section className="rounded-2xl border border-stone-200 bg-white" aria-labelledby="top-products">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <h2 id="top-products" className="headline text-xl">
              Top sellers
            </h2>
            <Link href="/admin/products" className="text-sm font-medium text-stone-500 hover:text-ink">
              Manage →
            </Link>
          </div>
          <ol className="divide-y divide-stone-100">
            {stats.topProducts.map((p, i) => (
              <li key={p._id} className="flex items-center gap-3 px-5 py-3">
                <span className="w-4 text-sm font-medium text-stone-400 tabular-nums">{i + 1}</span>
                <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                  {p.coverImage && (
                    <Image src={p.coverImage} alt="" fill sizes="40px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />
                  )}
                </div>
                <Link href={`/admin/products/${p._id}/edit`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                  {p.title}
                </Link>
                <span className="text-sm text-stone-500 tabular-nums">{p.salesCount.toLocaleString('en-US')} sold</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
