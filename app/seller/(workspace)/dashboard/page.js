import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, DollarSign, ShoppingBag } from 'lucide-react';
import ShopDetailsForm from '@/components/seller/ShopDetailsForm';
import { PageHeader, Panel, StatCard, StatusBadge, EmptyState, formatDateTime } from '@/components/dashboard/ui';
import { requireSellerStore } from '@/lib/auth';
import { getSellerDashboard } from '@/lib/data/seller';
import { getMonthlyEarnings } from '@/lib/data/seller-analytics';
import { EarningsPanel } from '@/components/dashboard/SellerAnalytics';
import { commissionPercent, splitSale, COMMISSION_RATE, NO_PLATFORM_FEE } from '@/lib/commission';
import { listingStatus } from '@/lib/listing';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { siteConfig } from '@/lib/site';

// `absolute`: the seller layout's title template only applies to child segments.
export const metadata = { title: { absolute: `Seller Dashboard · ${siteConfig.name}` } };

const usd = (cents) => formatPrice(cents, 'USD');

export default async function SellerDashboardPage() {
  const seller = await requireSellerStore();
  const [data, monthly] = await Promise.all([getSellerDashboard(seller.id), getMonthlyEarnings(seller.id, 12)]);

  return (
    <>
      {!data.hasPayoutMethod && (
        <div role="status" className="mb-8 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Add your payout details to get paid</p>
              <p className="mt-0.5 text-sm text-amber-800">
                You can list and sell right away. We just need a bank account or mobile wallet before we can send your earnings.
              </p>
            </div>
          </div>
          <Link href="/seller/payouts" className="btn btn-md btn-dark shrink-0">
            Add payout details
          </Link>
        </div>
      )}

      <PageHeader
        title={data.storeName}
        description={`${data.storeDescription ? `${data.storeDescription} · ` : ''}${NO_PLATFORM_FEE ? 'No platform fees, you keep 100% of every sale' : `You keep ${commissionPercent(1 - COMMISSION_RATE)} of every sale`}`}
      />

      <section aria-label="Earnings" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Earnings" value={usd(data.balances.totalEarnings)} sub={NO_PLATFORM_FEE ? 'Everything you’ve earned, all time' : `Your ${commissionPercent(1 - COMMISSION_RATE)} share, all time`} icon={DollarSign} featured />
        <StatCard label="Pending Payout" value={usd(data.balances.pendingPayout)} sub="Earned, not yet paid out" icon={Clock} tone="warning" />
        <StatCard label="Completed Payouts" value={usd(data.balances.paidPayout)} sub="Sent to your account" icon={CheckCircle2} tone="info" />
        <StatCard label="Total Sales" value={data.sales.count.toLocaleString('en-US')} sub={`${usd(data.sales.gross)} gross sales`} icon={ShoppingBag} />
      </section>

      {/* ---------- Earnings by month ---------- */}
      <div className="mt-8">
        <EarningsPanel months={monthly} title="Your earnings by month" />
      </div>

      {/* ---------- Products ---------- */}
      <div className="mt-8">
        <Panel
          title="Latest listings"
          action={
            <Link href="/seller/listings" className="text-sm font-medium text-stone-500 hover:text-ink">
              Manage all
            </Link>
          }
        >
          {data.products.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No listings yet">
                <Link href="/seller/listings/new" className="font-medium text-ink underline underline-offset-2">
                  Add your first listing
                </Link>
                . It goes live once approved.
              </EmptyState>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">Product</th>
                    <th scope="col" className="px-5 py-3 text-right">Price</th>
                    <th scope="col" className="px-5 py-3 text-right">You earn</th>
                    <th scope="col" className="px-5 py-3 text-right">Sales</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.products.map((p) => (
                    <tr key={p._id}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative aspect-[4/3] w-14 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                            {p.coverImage && <Image src={p.coverImage} alt="" fill sizes="56px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />}
                          </div>
                          <div className="min-w-0">
                            {p.status === 'approved' && p.isPublished ? (
                              <Link href={`/products/${p.slug}`} className="line-clamp-1 font-medium hover:underline">
                                {p.title}
                              </Link>
                            ) : (
                              <p className="line-clamp-1 font-medium">{p.title}</p>
                            )}
                            <p className="text-xs text-stone-500">Added {formatDateTime(p.createdAt).date}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{p.price == null ? '–' : usd(p.price)}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">{p.price == null ? '–' : usd(splitSale(p.price).sellerEarning)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{p.salesCount}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={listingStatus(p).tone} label={listingStatus(p).label} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        {/* ---------- Recent sales (ledger) ---------- */}
        <Panel
          title="Recent sales"
          action={
            <Link href="/seller/sales" className="text-sm font-medium text-stone-500 hover:text-ink">
              View all
            </Link>
          }
        >
          {data.recentSales.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone-500">Sales appear here the moment a buyer checks out.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.recentSales.map((t) => (
                <li key={t._id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.product?.title ?? 'Deleted product'}</p>
                    <p className="text-xs text-stone-500">
                      {formatDateTime(t.createdAt).date}
                      {t.commission > 0 && ` · ${usd(t.gross)} − ${usd(t.commission)} fee`}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums text-emerald-700">+{usd(t.sellerEarning)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ---------- Shop settings (payouts & bank details live on /seller/payouts) ---------- */}
        <Panel
          title="Shop settings"
          id="shop"
          action={
            <Link href="/seller/payouts" className="text-sm font-medium text-stone-500 hover:text-ink">
              Payouts & bank details
            </Link>
          }
        >
          <div className="p-5 sm:p-6">
            <ShopDetailsForm mode="update" initial={{ storeName: data.storeName, storeDescription: data.storeDescription }} />
          </div>
        </Panel>
      </div>
    </>
  );
}
