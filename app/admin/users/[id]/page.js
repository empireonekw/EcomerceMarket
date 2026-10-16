import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, DollarSign, Package, ShoppingBag, Wallet } from 'lucide-react';
import DeleteUserButton from '@/components/admin/DeleteUserButton';
import { Panel, StatCard, StatusBadge, RoleBadge, ProviderBadge, EmptyState, formatDateTime } from '@/components/dashboard/ui';
import { getAdminUserDetail } from '@/lib/data/admin-users';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'User details' };

const usd = (cents) => formatPrice(cents, 'USD');
const date = (d) => (d ? formatDateTime(d).date : '—');

function Details({ rows }) {
  return (
    <dl className="divide-y divide-stone-100 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 px-5 py-3">
          <dt className="text-stone-500">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminUserPage({ params }) {
  const { id } = await params;
  const u = await getAdminUserDetail(id);
  if (!u) notFound();
  const s = u.selling;

  return (
    <>
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-black">
        <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
        All users
      </Link>

      {/* ---------- Header ---------- */}
      <header className="mb-8 mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-600 text-xl font-medium text-white">
          {u.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="headline truncate text-3xl sm:text-4xl">{u.name}</h1>
            <RoleBadge role={u.role} />
            <StatusBadge status={u.status.tone} label={u.status.label} />
          </div>
          <p className="mt-1 truncate text-sm text-stone-500">
            {u.email} · Joined {date(u.createdAt)} · Last active {u.lastLoginAt ? date(u.lastLoginAt) : 'never'}
          </p>
        </div>
        {u.role !== 'admin' && (
          <div className="sm:ml-auto">
            <DeleteUserButton id={u.id} name={u.name} role={u.role} size="md" redirectTo="/admin/users" />
          </div>
        )}
      </header>

      {/* ---------- Numbers ---------- */}
      <section aria-label="Activity" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {s ? (
          <>
            <StatCard label="Products sold" value={s.sales} sub={`${usd(s.gross)} gross sales`} icon={ShoppingBag} />
            <StatCard label="Seller earnings" value={usd(s.earnings)} sub="Lifetime share after fees" icon={DollarSign} tone="positive" />
            <StatCard label="Pending payout" value={usd(s.pendingPayout)} sub={`${usd(s.paidPayout)} paid out so far`} icon={Clock} tone="warning" />
            <StatCard label="Products" value={s.products} sub={`${s.live} live · ${s.inReview} in review`} icon={Package} tone="info" />
          </>
        ) : (
          <>
            <StatCard label="Total spent" value={usd(u.purchases.spent)} sub="Paid orders" icon={DollarSign} tone="positive" />
            <StatCard label="Items purchased" value={u.purchases.items} sub={`${u.purchases.orders} paid order${u.purchases.orders === 1 ? '' : 's'} with this email`} icon={ShoppingBag} tone="info" />
            <StatCard label="Last purchase" value={date(u.purchases.lastAt)} icon={Clock} />
            <StatCard label="Member for" value={`${Math.max(0, Math.floor((Date.now() - new Date(u.createdAt)) / 86_400_000))} days`} sub={`Since ${date(u.createdAt)}`} icon={Wallet} />
          </>
        )}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1.4fr] xl:items-start">
        {/* ---------- Account + shop ---------- */}
        <div className="space-y-6">
          <Panel title="Account">
            <Details
              rows={[
                ['Name', u.name],
                ['Email', u.email],
                ['Account type', { customer: 'Customer', seller: 'Seller', admin: 'Administrator' }[u.role]],
                ['Joined', date(u.createdAt)],
                ['Last login', u.lastLoginAt ? `${date(u.lastLoginAt)} · ${formatDateTime(u.lastLoginAt).time}` : 'Never'],
                ['Terms accepted', date(u.termsAcceptedAt)],
              ]}
            />
          </Panel>

          {u.shop && (
            <Panel title="Shop">
              {u.shop.storeName ? (
                <>
                  <div className="border-b border-stone-100 px-5 py-4">
                    <p className="font-medium">{u.shop.storeName}</p>
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">{u.shop.storeDescription || 'No description.'}</p>
                  </div>
                  <Details
                    rows={[
                      ['Seller since', date(u.shop.joinedAt)],
                      ['Payout method', u.shop.payoutMethods.length ? u.shop.payoutMethods.join(' / ') : 'Not added yet'],
                    ]}
                  />
                </>
              ) : (
                <p className="px-5 py-6 text-sm text-stone-500">This seller signed up but hasn’t set up a shop yet.</p>
              )}
            </Panel>
          )}
        </div>

        {/* ---------- Activity ---------- */}
        <div className="space-y-6">
          {s && (
            <Panel title="Products">
              {u.products.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-stone-500">No products uploaded yet.</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {u.products.map((p) => (
                    <li key={p._id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <Link href={`/admin/products/${p._id}/edit`} className="block truncate font-medium hover:underline">
                          {p.title}
                        </Link>
                        <p className="text-xs text-stone-500">
                          {usd(p.price)} · {p.salesCount} sale{p.salesCount === 1 ? '' : 's'} · Added {date(p.createdAt)}
                        </p>
                      </div>
                      <StatusBadge
                        status={p.status === 'approved' && !p.isPublished ? 'cancelled' : p.status}
                        label={{ pending: 'In review', approved: p.isPublished ? 'Live' : 'Hidden', rejected: 'Rejected' }[p.status]}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {s && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Recent sales">
                {u.recentSales.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-stone-500">No sales yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {u.recentSales.map((t) => (
                      <li key={t._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{t.product?.title ?? 'Deleted product'}</p>
                          <p className="text-xs text-stone-500">{date(t.createdAt)}</p>
                        </div>
                        <span className="font-medium tabular-nums text-emerald-700">+{usd(t.sellerEarning)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel
                title="Payouts"
                action={
                  <Link href="/admin/payouts" className="text-sm text-stone-500 hover:text-black">
                    Manage
                  </Link>
                }
              >
                {u.payouts.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-stone-500">No payouts yet.</p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {u.payouts.map((p) => (
                      <li key={p._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                        <div>
                          <p className="font-medium tabular-nums">{usd(p.amount)}</p>
                          <p className="text-xs text-stone-500">
                            {date(p.paidAt ?? p.createdAt)}
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
          )}

          {/* Sellers sell rather than buy: only show purchases if they actually made some. */}
          {(!s || u.recentOrders.length > 0) && (
            <Panel title="Purchases" action={<span className="text-sm text-stone-500">{usd(u.purchases.spent)} total</span>}>
              {u.recentOrders.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No orders">Orders placed with {u.email} appear here.</EmptyState>
                </div>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {u.recentOrders.map((o) => (
                    <li key={o._id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{o.items.map((i) => i.title).join(', ')}</p>
                        <p className="text-xs text-stone-500">
                          #{o._id.slice(-8).toUpperCase()} · {date(o.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-medium tabular-nums">{formatPrice(o.totalAmount, o.currency)}</span>
                        <StatusBadge status={o.status} />
                        <ProviderBadge provider={o.paymentProvider} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
