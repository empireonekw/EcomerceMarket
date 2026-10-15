import Link from 'next/link';
import Form from 'next/form';
import Pagination from '@/components/Pagination';
import { PageHeader, EmptyState, StatusBadge, ProviderBadge, buttonClasses, formatDateTime } from '@/components/dashboard/ui';
import { getAdminOrders } from '@/lib/data/admin';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'Orders & Sales' };

const field = 'h-10 rounded-full border border-stone-300 bg-white px-4 text-sm focus:border-ink focus:outline-none';

/**
 * Recent orders ledger. Reads through the same query as GET /api/orders (lib/data/admin.js)
 * directly on the server — no HTTP round-trip to our own API.
 */
export default async function AdminOrdersPage({ searchParams }) {
  const sp = await searchParams;
  const params = { q: sp.q ?? '', status: sp.status ?? '', page: sp.page };
  const { items, pagination } = await getAdminOrders(params);
  const filtered = Boolean(params.q || params.status);

  return (
    <>
      <PageHeader
        title="Orders & Sales"
        description={`${pagination.total} order${pagination.total === 1 ? '' : 's'}${filtered ? ' match your filters' : ' total'} · newest first`}
      />

      <Form action="/admin/orders" className="mb-5 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="q" className="sr-only">
          Search orders
        </label>
        <input id="q" name="q" type="search" defaultValue={params.q} placeholder="Buyer email or order ID…" className={`${field} sm:w-80`} />
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select id="status" name="status" defaultValue={params.status} className={field}>
          <option value="">Any status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className={buttonClasses.secondary}>
            Filter
          </button>
          {filtered && (
            <Link href="/admin/orders" className="inline-flex h-10 items-center px-3 text-sm font-medium text-stone-500 hover:text-ink">
              Clear
            </Link>
          )}
        </div>
      </Form>

      {items.length === 0 ? (
        <EmptyState title={filtered ? 'No orders match these filters' : 'No orders yet'}>
          Completed checkouts appear here instantly.
        </EmptyState>
      ) : (
        <>
        {/* Phones: card list instead of a wide table. */}
        <ul className="space-y-3 md:hidden">
          {items.map((o) => {
            const { date, time } = formatDateTime(o.createdAt);
            return (
              <li key={o._id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-stone-500">#{o._id.slice(-8).toUpperCase()}</p>
                    <p className="truncate text-sm font-medium">{o.buyerEmail}</p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{formatPrice(o.totalAmount, o.currency)}</p>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-stone-600">{o.items.map((i) => i.title).join(', ')}</p>
                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                  <span className="flex items-center gap-1.5">
                    <StatusBadge status={o.status} />
                    <ProviderBadge provider={o.paymentProvider} />
                  </span>
                  <span className="text-xs text-stone-500">
                    {date} · {time}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Order & buyer</th>
                  <th scope="col" className="px-4 py-3">Items</th>
                  <th scope="col" className="px-4 py-3 text-right">Total paid</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {items.map((o) => {
                  const { date, time } = formatDateTime(o.createdAt);
                  const [first, ...rest] = o.items;
                  return (
                    <tr key={o._id} className="align-top transition-colors hover:bg-stone-50/60">
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-xs font-medium text-stone-500" title={o._id}>
                          #{o._id.slice(-8).toUpperCase()}
                        </p>
                        <p className="mt-0.5 max-w-[16rem] truncate font-medium">{o.buyerEmail}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="max-w-[18rem] truncate">{first?.title}</p>
                        {rest.length > 0 && (
                          <p className="text-xs text-stone-500" title={rest.map((i) => i.title).join(', ')}>
                            +{rest.length} more item{rest.length === 1 ? '' : 's'}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <p className="font-medium tabular-nums">{formatPrice(o.totalAmount, o.currency)}</p>
                        {(o.taxAmount > 0 || o.feeAmount > 0) && (
                          <p className="text-xs text-stone-500 tabular-nums">incl. {formatPrice(o.taxAmount + o.feeAmount, o.currency)} tax/fees</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge status={o.status} />
                          <ProviderBadge provider={o.paymentProvider} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-stone-600">
                        {date}
                        <span className="block text-xs text-stone-400">{time}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath="/admin/orders" params={{ q: params.q, status: params.status }} />
    </>
  );
}
