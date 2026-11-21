import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, MessageSquare } from 'lucide-react';
import DeleteUserButton from '@/components/admin/DeleteUserButton';
import IdReview from '@/components/admin/IdReview';
import ImportedRecordsPanel from '@/components/admin/ImportedRecordsPanel';
import { MetricCard } from '@/components/admin/analytics/KpiCard';
import { Avatar, Card, DetailList, TABLE_HEAD } from '@/components/admin/ui';
import PagedList from '@/components/dashboard/PagedList';
import { ActivityLog, EarningsPanel, ProductMonthlyPanel } from '@/components/dashboard/SellerAnalytics';
import { ProviderBadge, RoleBadge, StatusBadge, formatDateTime } from '@/components/dashboard/ui';
import VerifiedBadge from '@/components/VerifiedBadge';
import { getImportedRecords } from '@/lib/data/imported';
import { getAdminUserDetail } from '@/lib/data/admin-users';
import { getMonthlyEarnings, getProductMonthlyEarnings, getSellerActivity } from '@/lib/data/seller-analytics';
import { listingStatus } from '@/lib/listing';
import { countryOf, CURRENCIES } from '@/lib/seller-onboarding';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'User details' };

const usd = (cents) => formatPrice(cents, 'USD');
const date = (d) => (d ? formatDateTime(d).date : 'Never');
const daysSince = (d) => Math.max(0, Math.floor((Date.now() - new Date(d)) / 86_400_000));

/**
 * Admin → one user. Sellers with an ID check see it first (that's usually why an admin is here), then their numbers,
 * then products, sales and payouts on the left and the shop, account and contact details on the right.
 */
export default async function AdminUserPage({ params }) {
  const { id } = await params;
  const u = await getAdminUserDetail(id); // authorizes the admin first
  if (!u) notFound();
  const s = u.selling;
  const shop = u.shop;
  const [monthly, byProduct, activity, imported] = s
    ? await Promise.all([getMonthlyEarnings(u.id, 12), getProductMonthlyEarnings(u.id, 6), getSellerActivity(u.id), getImportedRecords(u.id)])
    : [];
  const a = shop?.address;

  return (
    <>
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-ink">
        <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
        Users
      </Link>

      {/* ---------- Who ---------- */}
      <header className="mt-3 mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={u.name} size="lg" tone={u.role === 'seller' ? 'brand' : 'stone'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[1.75rem] leading-tight font-semibold tracking-tight text-ink">{u.name}</h1>
            {shop?.verification?.status === 'verified' && <VerifiedBadge size={22} />}
            <RoleBadge role={u.role} />
            <StatusBadge status={u.status.tone} label={u.status.label} />
          </div>
          <p className="mt-1 text-sm break-words text-stone-500">
            {u.email}
            {shop?.storeName && <> · {shop.storeName}</>} · Joined {date(u.createdAt)} · Last active {date(u.lastLoginAt)}
          </p>
        </div>
        {u.role !== 'admin' && (
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {shop?.storeName && (
              <a href={`/shop/${u.id}`} target="_blank" rel="noopener" className="btn btn-md btn-outline">
                <ExternalLink size={15} strokeWidth={1.75} aria-hidden="true" />
                View shop
              </a>
            )}
            <Link href={`/admin/messages?user=${u.id}`} className="btn btn-md btn-dark">
              <MessageSquare size={15} strokeWidth={1.75} aria-hidden="true" />
              Message
            </Link>
            <DeleteUserButton id={u.id} name={u.name} role={u.role} size="md" redirectTo="/admin/users" />
          </div>
        )}
      </header>

      {/* ---------- Identity check first ---------- */}
      {shop?.verification && (
        <div className="mb-4">
          <IdReview userId={u.id} name={u.name} email={u.email} shop={shop} />
        </div>
      )}

      {/* ---------- Numbers ---------- */}
      <section aria-label="Numbers" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {s ? (
          <>
            <MetricCard label="Seller earnings" value={usd(s.earnings)} sub={`${usd(s.gross)} in gross sales`} tone="brand" />
            <MetricCard label="Products sold" value={s.sales.toLocaleString('en-US')} sub={`${s.sales === 1 ? 'sale' : 'sales'} so far`} />
            <MetricCard label="Listings" value={s.products.toLocaleString('en-US')} sub={`${s.live} live · ${s.inReview} in review`} />
            <MetricCard label="Pending payout" value={usd(s.pendingPayout)} sub={`${usd(s.paidPayout)} paid out so far`} tone="ink" />
          </>
        ) : (
          <>
            <MetricCard label="Total spent" value={usd(u.purchases.spent)} sub="Paid orders" tone="brand" />
            <MetricCard
              label="Items purchased"
              value={u.purchases.items.toLocaleString('en-US')}
              sub={`${u.purchases.orders} paid order${u.purchases.orders === 1 ? '' : 's'}`}
            />
            <MetricCard label="Last purchase" value={u.purchases.lastAt ? date(u.purchases.lastAt) : 'None yet'} sub="With this email" />
            <MetricCard label="Member for" value={`${daysSince(u.createdAt)} days`} sub={`Since ${date(u.createdAt)}`} tone="ink" />
          </>
        )}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        {/* ---------- Main column ---------- */}
        <div className="min-w-0 space-y-4">
          {s && s.sales > 0 && <EarningsPanel months={monthly} title="Seller earnings by month" />}

          {s && (
            <Card title="Listings" sub={`${s.products} listing${s.products === 1 ? '' : 's'}, newest first`} bodyClassName="px-3 pb-3 pt-3">
              {u.products.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone-500">No products uploaded yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_5rem_4rem_7rem] gap-3 rounded-lg bg-stone-50 px-3 py-2.5 text-xs font-medium text-stone-500 max-sm:hidden">
                    <span>Listing</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Sales</span>
                    <span className="text-right">Status</span>
                  </div>
                  <PagedList pageSize={8} label="Listings" className="divide-y divide-stone-100">
                    {u.products.map((p) => (
                      <li
                        key={p._id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_5rem_4rem_7rem]"
                      >
                        <div className="min-w-0">
                          <Link href={`/admin/products/${p._id}/edit`} className="line-clamp-1 font-medium text-ink hover:underline" title={p.title}>
                            {p.title}
                          </Link>
                          <p className="text-xs text-stone-500">Added {date(p.createdAt)}</p>
                        </div>
                        <span className="text-right tabular-nums text-stone-700 max-sm:hidden">{usd(p.price)}</span>
                        <span className="text-right tabular-nums text-stone-700 max-sm:hidden">{p.salesCount}</span>
                        <span className="text-right">
                          <StatusBadge status={listingStatus(p).tone} label={listingStatus(p).label} />
                        </span>
                      </li>
                    ))}
                  </PagedList>
                </>
              )}
            </Card>
          )}

          {s && (
            <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
              <Card title="Recent sales" bodyClassName="px-5 pb-3 pt-2">
                {u.recentSales.length === 0 ? (
                  <p className="py-8 text-center text-sm text-stone-500">No sales yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {u.recentSales.map((t) => (
                      <li key={t._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{t.product?.title ?? 'Deleted product'}</p>
                          <p className="text-xs text-stone-500">{date(t.createdAt)}</p>
                        </div>
                        <span className="font-semibold tabular-nums text-emerald-700">+{usd(t.sellerEarning)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Payouts" href="/admin/payouts" linkLabel="Manage" bodyClassName="px-5 pb-3 pt-2">
                {u.payouts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-stone-500">No payouts yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {u.payouts.map((p) => (
                      <li key={p._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div>
                          <p className="font-semibold tabular-nums text-ink">{usd(p.amount)}</p>
                          <p className="text-xs text-stone-500">
                            {date(p.paidAt ?? p.createdAt)}
                            {p.fee > 0 && ` · ${usd(p.netAmount ?? p.amount - p.fee)} after ${usd(p.fee)} fee`}
                            {p.reference && ` · Ref ${p.reference}`}
                          </p>
                        </div>
                        <StatusBadge status={p.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}

          {s && s.sales > 0 && <ProductMonthlyPanel data={byProduct} />}

          {/* Sellers sell rather than buy: only show purchases if they actually made some. */}
          {(!s || u.recentOrders.length > 0) && (
            <Card title="Purchases" sub={`${usd(u.purchases.spent)} spent in total`} bodyClassName="px-3 pb-3 pt-3">
              {u.recentOrders.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone-500">Orders placed with {u.email} appear here.</p>
              ) : (
                <table className="w-full table-fixed text-sm">
                  <thead className={TABLE_HEAD}>
                    <tr>
                      <th className="pl-3">Items</th>
                      <th className="w-28 max-sm:hidden">Date</th>
                      <th className="w-32 pr-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {u.recentOrders.map((o) => (
                      <tr key={o._id}>
                        <td className="py-2.5 pr-3 pl-3">
                          <p className="truncate font-medium text-ink">{o.items.map((i) => i.title).join(', ')}</p>
                          <p className="text-xs text-stone-500">#{o._id.slice(-8).toUpperCase()}</p>
                        </td>
                        <td className="py-2.5 whitespace-nowrap text-stone-500 max-sm:hidden">{date(o.createdAt)}</td>
                        <td className="py-2.5 pr-3 text-right">
                          <span className="font-semibold tabular-nums text-ink">{formatPrice(o.totalAmount, o.currency)}</span>
                          <span className="mt-0.5 flex justify-end gap-1">
                            <ProviderBadge provider={o.paymentProvider} />
                            <StatusBadge status={o.status} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {shop?.storeName && imported && (
            <Card title="Sales & reviews from their other shop" bodyClassName="pt-1">
              <ImportedRecordsPanel sellerId={u.id} records={imported} />
            </Card>
          )}
        </div>

        {/* ---------- Side column ---------- */}
        <div className="min-w-0 space-y-4">
          {shop && (
            <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              {shop.storeName ? (
                <>
                  {shop.banner ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shop.banner} alt="" className="aspect-[4/1] w-full object-cover" />
                  ) : (
                    <div aria-hidden="true" className="aspect-[5/1] w-full bg-gradient-to-r from-brand-100 to-peach-100" />
                  )}
                  <div className="px-5 pb-5">
                    <div className="-mt-7 flex items-end gap-3">
                      {shop.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={shop.logo} alt="" className="size-14 rounded-full object-cover ring-4 ring-white" />
                      ) : (
                        <span className="rounded-full ring-4 ring-white">
                          <Avatar name={shop.storeName} size="lg" tone="ink" />
                        </span>
                      )}
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 font-semibold text-ink">
                      {shop.storeName}
                      {shop.verification?.status === 'verified' && <VerifiedBadge size={16} />}
                    </p>
                    <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-stone-600" title={shop.storeDescription || undefined}>
                      {shop.storeDescription || 'No description yet.'}
                    </p>
                    <div className="mt-4">
                      <DetailList
                        rows={[
                          ['Seller since', date(shop.joinedAt)],
                          ['Payout method', shop.payoutMethods.length ? shop.payoutMethods.join(' / ') : 'Not added yet'],
                        ]}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-5">
                  <h2 className="text-[15px] font-semibold text-ink">Shop</h2>
                  <p className="mt-2 text-sm text-stone-500">This seller signed up but hasn’t opened their shop yet.</p>
                </div>
              )}
            </section>
          )}

          <Card title="Account" bodyClassName="px-5 pb-3 pt-1">
            <DetailList
              rows={[
                ['Email', u.email],
                ['Account type', { customer: 'Shopper', seller: 'Seller', admin: 'Administrator' }[u.role]],
                ['Joined', date(u.createdAt)],
                ['Last login', u.lastLoginAt ? `${date(u.lastLoginAt)}, ${formatDateTime(u.lastLoginAt).time}` : 'Never'],
                ['Terms accepted', date(u.termsAcceptedAt)],
              ]}
            />
          </Card>

          {shop?.preferences && (
            <Card title="Location & contact" sub="Private: only the seller and admins see this" bodyClassName="px-5 pb-3 pt-1">
              <DetailList
                rows={[
                  ['Country', countryOf(shop.preferences.country)?.name ?? 'Not given'],
                  ['Currency', CURRENCIES.find((c) => c.value === shop.preferences.currency)?.label ?? 'Not given'],
                  ['Address', a ? [a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(', ') : 'Not given'],
                  ['Phone', shop.phone ? `${shop.phone.dial} ${shop.phone.number}` : 'Not given'],
                ]}
              />
            </Card>
          )}

          {s && <ActivityLog events={activity} />}
        </div>
      </div>
    </>
  );
}
