import Link from 'next/link';
import Form from 'next/form';
import { Store, UserPlus, Users, UserRound } from 'lucide-react';
import Pagination from '@/components/Pagination';
import DeleteUserButton from '@/components/admin/DeleteUserButton';
import { PageHeader, StatCard, EmptyState, StatusBadge, RoleBadge, buttonClasses, formatDateTime } from '@/components/dashboard/ui';
import { getAdminUsers } from '@/lib/data/admin-users';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'Users' };

const usd = (cents) => formatPrice(cents, 'USD');
const field = 'h-11 rounded-full border border-stone-300 bg-white px-4 text-sm focus:border-black focus:outline-none';

const ROLE_TABS = [
  { value: '', label: 'All users', key: 'total' },
  { value: 'customer', label: 'Customers', key: 'customer' },
  { value: 'seller', label: 'Sellers', key: 'seller' },
  { value: 'admin', label: 'Admins', key: 'admin' },
];

function tabHref(role, q) {
  const qs = new URLSearchParams();
  if (role) qs.set('role', role);
  if (q) qs.set('q', q);
  const s = qs.toString();
  return s ? `/admin/users?${s}` : '/admin/users';
}

const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

/** Items purchased (paid orders with this email, guest checkouts included) and money spent. */
function Purchases({ p }) {
  if (!p.items) return <span className="text-stone-400">—</span>;
  return (
    <>
      <p className="font-medium tabular-nums">{plural(p.items, 'item')}</p>
      <p className="text-xs text-stone-500 tabular-nums">
        {usd(p.spent)} · {plural(p.orders, 'order')}
      </p>
    </>
  );
}

/** Products sold (one per sale line) and gross revenue; listings live / total underneath. */
function Selling({ s }) {
  if (!s) return <span className="text-stone-400">—</span>;
  return (
    <>
      <p className="font-medium tabular-nums">{plural(s.sales, 'product')} sold</p>
      <p className="text-xs text-stone-500 tabular-nums">
        {usd(s.gross)} · {s.live}/{s.products} live
      </p>
    </>
  );
}

/** Admins can't be deleted from here (nor yourself — the API refuses both). */
function Actions({ u }) {
  if (u.role === 'admin') return <span className="text-xs text-stone-400">Protected</span>;
  return <DeleteUserButton id={u.id} name={u.name} role={u.role} />;
}

const lastActive = (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt).date : 'never');

/** Every account — customers, sellers and admins — with status, purchases and selling at a glance. */
export default async function AdminUsersPage({ searchParams }) {
  const sp = await searchParams;
  const params = { q: (sp.q ?? '').trim(), role: sp.role ?? '', page: sp.page };
  const { items, pagination, summary } = await getAdminUsers(params);
  const filtered = Boolean(params.q || params.role);

  return (
    <>
      <PageHeader
        title="Users"
        description={`${pagination.total} account${pagination.total === 1 ? '' : 's'}${filtered ? ' match your filters' : ''} · newest first`}
      />

      <section aria-label="User totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={summary.total.toLocaleString('en-US')} sub={`${summary.byRole.admin} admin${summary.byRole.admin === 1 ? '' : 's'}`} icon={Users} />
        <StatCard label="Customers" value={summary.byRole.customer.toLocaleString('en-US')} sub="Shopping accounts" icon={UserRound} tone="info" />
        <StatCard
          label="Sellers"
          value={summary.byRole.seller.toLocaleString('en-US')}
          sub={summary.setupPending ? `${summary.setupPending} haven’t set up a shop` : 'All shops set up'}
          icon={Store}
          tone={summary.setupPending ? 'warning' : 'positive'}
        />
        <StatCard label="New in 30 days" value={summary.newLast30d.toLocaleString('en-US')} sub="Sign-ups this month" icon={UserPlus} tone="positive" />
      </section>

      <div className="mb-5 mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter by role" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {ROLE_TABS.map((t) => {
            const active = params.role === t.value;
            return (
              <Link
                key={t.value || 'all'}
                href={tabHref(t.value, params.q)}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors ${active ? 'bg-black text-white' : 'text-stone-600 hover:bg-stone-100 hover:text-black'}`}
              >
                {t.label}
                <span className={`ml-1.5 tabular-nums ${active ? 'text-white/60' : 'text-stone-400'}`}>
                  {t.key === 'total' ? summary.total : summary.byRole[t.key]}
                </span>
              </Link>
            );
          })}
        </nav>

        <Form action="/admin/users" className="flex gap-2">
          {params.role && <input type="hidden" name="role" value={params.role} />}
          <label htmlFor="q" className="sr-only">
            Search users
          </label>
          <input id="q" name="q" type="search" defaultValue={params.q} placeholder="Name, email or shop…" className={`${field} w-full lg:w-72`} />
          <button type="submit" className={buttonClasses.secondary}>
            Search
          </button>
        </Form>
      </div>

      {items.length === 0 ? (
        <EmptyState title={filtered ? 'No users match these filters' : 'No users yet'}>
          {filtered && (
            <Link href="/admin/users" className="font-medium text-black underline underline-offset-2">
              Clear filters
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          {/* Phones: cards instead of a wide table. */}
          <ul className="space-y-3 md:hidden">
            {items.map((u) => (
              <li key={u.id} className="relative rounded-2xl border border-stone-200 bg-white p-4 transition-shadow hover:shadow-lift">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${u.id}`} className="block truncate font-medium after:absolute after:inset-0 after:rounded-2xl">
                      {u.name}
                    </Link>
                    <p className="truncate text-sm text-stone-500">{u.selling?.storeName ?? u.email}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {u.selling ? `${plural(u.selling.sales, 'product')} sold` : `${plural(u.purchases.items, 'item')} purchased`} · Joined{' '}
                  {formatDateTime(u.createdAt).date}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
                  <StatusBadge status={u.status.tone} label={u.status.label} />
                  <Actions u={u} />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">User</th>
                    <th scope="col" className="px-4 py-3">Role</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">Purchases</th>
                    <th scope="col" className="px-4 py-3 text-right">Selling</th>
                    <th scope="col" className="px-4 py-3">Joined</th>
                    <th scope="col" className="px-4 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((u) => (
                    <tr key={u.id} className="relative transition-colors hover:bg-stone-50/70">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-medium text-stone-700">
                            {u.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            {/* Stretched link: the whole row opens the user. */}
                            <Link href={`/admin/users/${u.id}`} className="block max-w-[13rem] truncate font-medium after:absolute after:inset-0 hover:underline">
                              {u.name}
                            </Link>
                            <p className="max-w-[13rem] truncate text-xs text-stone-500">{u.email}</p>
                            {u.selling?.storeName && <p className="max-w-[13rem] truncate text-xs text-brand-700">{u.selling.storeName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={u.status.tone} label={u.status.label} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <Purchases p={u.purchases} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <Selling s={u.selling} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-stone-600">
                        {formatDateTime(u.createdAt).date}
                        <span className="block text-xs text-stone-400">Active {lastActive(u)}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Actions u={u} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath="/admin/users" params={{ q: params.q, role: params.role }} />
    </>
  );
}
