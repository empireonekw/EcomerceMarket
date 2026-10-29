import Link from 'next/link';
import Form from 'next/form';
import { CircleDollarSign, Percent, ShoppingBag, Wallet } from 'lucide-react';
import Pagination from '@/components/Pagination';
import { PageHeader, StatCard, EmptyState, ProviderBadge, buttonClasses, formatDateTime } from '@/components/dashboard/ui';
import { requireSellerStore } from '@/lib/auth';
import { getSellerSales, SALES_PAGE_SIZE } from '@/lib/data/seller-analytics';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'Sales history' };

const usd = (cents) => formatPrice(cents, 'USD');
const field = 'h-11 rounded-full border border-stone-300 bg-white px-4 text-sm focus:border-black focus:outline-none';

/** The last 12 months as filter options, newest first. */
function monthOptions() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return { value: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
  });
}

/**
 * Seller → Sales history: every sale from the ledger — date, product, order, buyer (email partly hidden),
 * price, platform fee (only when older sales had one) and what the seller earned. Server-rendered on each request, so it's always current.
 */
export default async function SellerSalesPage({ searchParams }) {
  const seller = await requireSellerStore('/seller/sales');
  const sp = await searchParams;
  const months = monthOptions();
  const month = months.some((m) => m.value === sp.month) ? sp.month : '';
  const { items, totals, pagination } = await getSellerSales(seller.id, { page: sp.page, month });
  const period = month ? months.find((m) => m.value === month).label : 'All time';
  // There's no platform fee now; the fee column/card only appears for older sales that were charged one.
  const showFees = totals.commission > 0;

  return (
    <>
      <PageHeader title="Sales history" description={`Every sale of your products · ${period}`} />

      <section aria-label="Sales totals" className={`grid gap-4 sm:grid-cols-2 ${showFees ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        <StatCard label="Products sold" value={totals.count.toLocaleString('en-US')} sub={period} icon={ShoppingBag} />
        <StatCard label="Gross sales" value={usd(totals.gross)} sub="What buyers paid" icon={CircleDollarSign} tone="info" />
        {showFees && <StatCard label="Platform fees" value={usd(totals.commission)} sub="Commission on these sales" icon={Percent} />}
        <StatCard label="You earned" value={usd(totals.earnings)} sub="Your share of these sales" icon={Wallet} tone="positive" />
      </section>

      <Form action="/seller/sales" className="mb-5 mt-8 flex flex-wrap items-center gap-2">
        <label htmlFor="month" className="sr-only">
          Month
        </label>
        <select id="month" name="month" defaultValue={month} className={field}>
          <option value="">All time</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClasses.secondary}>
          Show
        </button>
        {month && (
          <Link href="/seller/sales" className="inline-flex h-10 items-center px-3 text-sm font-medium text-stone-500 hover:text-black">
            Clear
          </Link>
        )}
      </Form>

      {items.length === 0 ? (
        <EmptyState title={month ? `No sales in ${period}` : 'No sales yet'}>Sales appear here the moment a buyer checks out.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Date</th>
                  <th scope="col" className="px-5 py-3">Product</th>
                  <th scope="col" className="px-5 py-3">Order</th>
                  <th scope="col" className="px-5 py-3">Buyer</th>
                  <th scope="col" className="px-5 py-3 text-right">Price</th>
                  {showFees && <th scope="col" className="px-5 py-3 text-right">Fee</th>}
                  <th scope="col" className="px-5 py-3 text-right">You earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 tabular-nums">
                {items.map((s) => {
                  const { date, time } = formatDateTime(s.createdAt);
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-stone-600">
                        {date}
                        <span className="block text-xs text-stone-400">{time}</span>
                      </td>
                      <td className="max-w-[16rem] px-5 py-3">
                        <span className="block truncate font-medium">{s.product?.title ?? 'Deleted product'}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span className="font-mono text-xs text-stone-500">#{s.orderNumber ?? '–'}</span>
                        {s.demo && (
                          <span className="ml-2">
                            <ProviderBadge provider="demo" />
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-stone-600">{s.buyer}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">{usd(s.gross)}</td>
                      {showFees && <td className="whitespace-nowrap px-5 py-3 text-right text-stone-500">{s.commission > 0 ? `−${usd(s.commission)}` : '–'}</td>}
                      <td className="whitespace-nowrap px-5 py-3 text-right font-medium text-emerald-700">+{usd(s.earnings)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
            Buyer emails are partly hidden to protect customer privacy. Showing up to {SALES_PAGE_SIZE} sales per page.
          </p>
        </div>
      )}

      <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath="/seller/sales" params={{ month }} />
    </>
  );
}
