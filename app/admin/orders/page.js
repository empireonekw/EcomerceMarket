import Pagination from '@/components/Pagination';
import DeleteOrderButton from '@/components/admin/DeleteOrderButton';
import { SearchBox, SegmentedNav } from '@/components/admin/ListToolbar';
import OrderStatusSelect from '@/components/admin/OrderStatusSelect';
import { MetricCard } from '@/components/admin/analytics/KpiCard';
import { Avatar, PageTitle, TABLE_HEAD } from '@/components/admin/ui';
import { PendingContent, PendingNavProvider } from '@/components/dashboard/PendingNav';
import { AdminOrdersSkeleton } from '@/components/dashboard/RouteSkeletons';
import { EmptyState, ProviderBadge, formatDateTime } from '@/components/dashboard/ui';
import { getAdminOrders, getOrderSummary } from '@/lib/data/admin';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'Orders & Sales' };

const STATUS_TABS = [
  { value: '', label: 'All', count: 'all' },
  { value: 'completed', label: 'Completed', count: 'completed' },
  { value: 'pending', label: 'Pending', count: 'pending' },
  { value: 'cancelled', label: 'Cancelled', count: 'cancelled' },
];

function ordersHref(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/admin/orders?${s}` : '/admin/orders';
}

/**
 * Admin → Orders & Sales. Each status is a dropdown (components/admin/OrderStatusSelect.jsx): automatic from the
 * payment until an admin changes it. Reads through the same query as GET /api/orders (lib/data/admin.js).
 */
export default async function AdminOrdersPage({ searchParams }) {
  const sp = await searchParams;
  const params = { q: (sp.q ?? '').trim(), status: sp.status ?? '', page: sp.page };
  const [{ items, pagination }, summary] = await Promise.all([getAdminOrders(params), getOrderSummary()]);
  const keep = { q: params.q, status: params.status };
  const filtered = Boolean(params.q || params.status);
  const usd = (cents) => formatPrice(cents, 'USD');
  const shown =
    pagination.total === 0
      ? 'No orders'
      : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total.toLocaleString('en-US')}`;

  return (
    <>
      <PageTitle title="Orders & Sales" description="Every checkout, newest first. A status follows the payment until you change it by hand." />

      <section aria-label="Order totals" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={usd(summary.revenue)}
          sub={`From ${summary.paidOrders} paid order${summary.paidOrders === 1 ? '' : 's'}`}
          tone="brand"
        />
        <MetricCard
          label="Completed"
          value={summary.counts.completed.toLocaleString('en-US')}
          sub="Paid and delivered"
          href={ordersHref({ status: 'completed' })}
        />
        <MetricCard
          label="Pending"
          value={summary.counts.pending.toLocaleString('en-US')}
          sub="Waiting for payment"
          href={ordersHref({ status: 'pending' })}
        />
        <MetricCard
          label="Cancelled"
          value={summary.counts.cancelled.toLocaleString('en-US')}
          sub="Failed or cancelled payments"
          tone="ink"
          href={ordersHref({ status: 'cancelled' })}
        />
      </section>

      <PendingNavProvider>
        <div className="mt-4 mb-4 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedNav
            label="Filter by status"
            activeKey={params.status}
            items={STATUS_TABS.map((t) => ({
              key: t.value,
              label: t.label,
              count: summary.counts[t.count],
              href: ordersHref({ ...keep, status: t.value }),
            }))}
          />
          <SearchBox action="/admin/orders" params={{ ...keep, q: '' }} defaultValue={params.q} placeholder="Buyer email or order ID…" />
        </div>

        <PendingContent fallback={<AdminOrdersSkeleton />}>
          {items.length === 0 ? (
            <EmptyState title={filtered ? 'No orders match these filters' : 'No orders yet'}>Completed checkouts appear here instantly.</EmptyState>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <p className="text-sm font-semibold text-ink">Orders</p>
                <span className="text-xs text-stone-500">{shown}</span>
              </div>

              {/* Phones: rows instead of a wide table. */}
              <ul className="divide-y divide-stone-100 border-t border-stone-100 md:hidden">
                {items.map((o) => {
                  const { date, time } = formatDateTime(o.createdAt);
                  return (
                    <li key={o._id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={o.buyerEmail} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{o.buyerEmail}</p>
                            <p className="text-xs text-stone-500 tabular-nums">#{o._id.slice(-8).toUpperCase()}</p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold tabular-nums text-ink">{formatPrice(o.totalAmount, o.currency)}</p>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-stone-600">{o.items.map((i) => i.title).join(', ')}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <OrderStatusSelect order={o} />
                          <ProviderBadge provider={o.paymentProvider} />
                        </span>
                        <span className="flex items-center gap-1 text-xs text-stone-500">
                          {date}, {time}
                          <DeleteOrderButton order={o} />
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden px-3 pb-3 md:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className={TABLE_HEAD}>
                      <tr>
                        <th scope="col" className="pl-3">
                          Order & buyer
                        </th>
                        <th scope="col" className="px-3">
                          Items
                        </th>
                        <th scope="col" className="px-3 text-right">
                          Total paid
                        </th>
                        <th scope="col" className="px-3">
                          Status
                        </th>
                        <th scope="col" className="px-3">
                          Date
                        </th>
                        <th scope="col" className="w-12 pr-3">
                          <span className="sr-only">Delete</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {items.map((o) => {
                        const { date, time } = formatDateTime(o.createdAt);
                        const [first, ...rest] = o.items;
                        return (
                          <tr key={o._id} className="transition-colors hover:bg-stone-50/80">
                            <td className="py-3 pl-3">
                              <div className="flex items-center gap-3">
                                <Avatar name={o.buyerEmail} />
                                <div className="min-w-0">
                                  <p className="max-w-[16rem] truncate font-semibold text-ink">{o.buyerEmail}</p>
                                  <p className="text-xs text-stone-500 tabular-nums" title={o._id}>
                                    #{o._id.slice(-8).toUpperCase()}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <p className="max-w-[18rem] truncate text-stone-700">{first?.title}</p>
                              {rest.length > 0 && (
                                <p className="text-xs text-stone-500" title={rest.map((i) => i.title).join(', ')}>
                                  +{rest.length} more item{rest.length === 1 ? '' : 's'}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <p className="font-semibold tabular-nums text-ink">{formatPrice(o.totalAmount, o.currency)}</p>
                              {(o.taxAmount > 0 || o.feeAmount > 0) && (
                                <p className="text-xs text-stone-500 tabular-nums">
                                  incl. {formatPrice(o.taxAmount + o.feeAmount, o.currency)} tax/fees
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <OrderStatusSelect order={o} />
                                <ProviderBadge provider={o.paymentProvider} />
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-stone-600">
                              {date}
                              <span className="block text-xs text-stone-400">{time}</span>
                            </td>
                            <td className="py-3 pr-3">
                              <DeleteOrderButton order={o} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath="/admin/orders" params={keep} />
        </PendingContent>
      </PendingNavProvider>
    </>
  );
}
