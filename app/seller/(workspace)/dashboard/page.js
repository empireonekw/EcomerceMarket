import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, DollarSign, Plus, ShoppingBag } from 'lucide-react';
import PayoutDetailsForm from '@/components/seller/PayoutDetailsForm';
import ShopDetailsForm from '@/components/seller/ShopDetailsForm';
import RequestPayoutButton from '@/components/seller/RequestPayoutButton';
import { PageHeader, Panel, StatCard, StatusBadge, EmptyState, buttonClasses, formatDateTime } from '@/components/dashboard/ui';
import { requireSellerStore } from '@/lib/auth';
import { getSellerDashboard } from '@/lib/data/seller';
import { getMonthlyEarnings } from '@/lib/data/seller-analytics';
import { EarningsPanel } from '@/components/dashboard/SellerAnalytics';
import { commissionPercent, splitSale, COMMISSION_RATE } from '@/lib/commission';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { siteConfig } from '@/lib/site';

// `absolute`: the seller layout's title template only applies to child segments.
export const metadata = { title: { absolute: `Seller Dashboard · ${siteConfig.name}` } };

const usd = (cents) => formatPrice(cents, 'USD');

function payoutBlocker(data) {
  if (data.openRequest) return `Request for ${usd(data.openRequest.amount)} sent ${formatDateTime(data.openRequest.createdAt).date} — awaiting payment.`;
  if (data.balances.pendingPayout <= 0) return 'Your pending balance is empty.';
  if (!data.hasPayoutMethod) return 'Add bank or wallet details below first.';
  return null;
}

export default async function SellerDashboardPage() {
  const seller = await requireSellerStore();
  const [data, monthly] = await Promise.all([getSellerDashboard(seller.id), getMonthlyEarnings(seller.id, 12)]);
  const blocker = payoutBlocker(data);

  return (
    <>
      {!data.hasPayoutMethod && (
        <div role="status" className="mb-8 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Add your payout details to get paid</p>
              <p className="mt-0.5 text-sm text-amber-800">
                You can list and sell right away — we just need a bank account or mobile wallet before we can send your earnings.
              </p>
            </div>
          </div>
          <a href="#payouts" className="btn btn-md btn-dark shrink-0">
            Add payout details
          </a>
        </div>
      )}

      <PageHeader
        title={data.storeName}
        description={`${data.storeDescription ? `${data.storeDescription} · ` : ''}You keep ${commissionPercent(1 - COMMISSION_RATE)} of every sale`}
        actions={
          <Link href="/seller/products/add" className={buttonClasses.primary}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add product
          </Link>
        }
      />

      <section aria-label="Earnings" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Earnings" value={usd(data.balances.totalEarnings)} sub={`Your ${commissionPercent(1 - COMMISSION_RATE)} share, all time`} icon={DollarSign} tone="positive" />
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
          title="My products"
          action={
            <Link href="/seller/products" className="text-sm font-medium text-stone-500 hover:text-ink">
              Manage all
            </Link>
          }
        >
          {data.products.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No products yet">
                <Link href="/seller/products/add" className="font-medium text-ink underline underline-offset-2">
                  Upload your first product
                </Link>{' '}
                — it goes live once approved.
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
                      <td className="px-5 py-3 text-right tabular-nums">{usd(p.price)}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">{usd(splitSale(p.price).sellerEarning)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{p.salesCount}</td>
                      <td className="px-5 py-3">
                        <StatusBadge
                          status={p.status === 'approved' && !p.isPublished ? 'cancelled' : p.status}
                          label={{ pending: 'In review', approved: p.isPublished ? 'Live' : 'Hidden', rejected: 'Rejected' }[p.status]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
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
                      {formatDateTime(t.createdAt).date} · {usd(t.gross)} − {usd(t.commission)} fee
                    </p>
                  </div>
                  <span className="font-medium tabular-nums text-emerald-700">+{usd(t.sellerEarning)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ---------- Payouts ---------- */}
        <Panel title="Payouts" action={<span className="text-sm text-stone-500">Available: {usd(data.balances.pendingPayout)}</span>}>
          <div className="border-b border-stone-100 p-5">
            <RequestPayoutButton disabled={Boolean(blocker)} reason={blocker} />
          </div>
          {data.payouts.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-stone-500">No payouts yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {data.payouts.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium tabular-nums">{usd(p.amount)}</p>
                    <p className="text-xs text-stone-500">
                      {formatDateTime(p.paidAt ?? p.createdAt).date}
                      {p.reference && ` · Ref ${p.reference}`}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---------- Settings ---------- */}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-start">
        <Panel title="Payout details" id="payouts">
          <div className="p-5 sm:p-6">
            <PayoutDetailsForm initial={data.bankDetails} />
          </div>
        </Panel>
        <Panel title="Shop settings" id="shop">
          <div className="p-5 sm:p-6">
            <ShopDetailsForm mode="update" initial={{ storeName: data.storeName, storeDescription: data.storeDescription }} />
          </div>
        </Panel>
      </div>
    </>
  );
}
