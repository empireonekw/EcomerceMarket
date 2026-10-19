import Link from 'next/link';
import Form from 'next/form';
import { Store, UserPlus, Users, UserRound } from 'lucide-react';
import Pagination from '@/components/Pagination';
import UsersTable from '@/components/admin/UsersTable';
import { PageHeader, StatCard, EmptyState, buttonClasses } from '@/components/dashboard/ui';
import { requireAdmin } from '@/lib/auth';
import { getAdminUsers } from '@/lib/data/admin-users';

export const metadata = { title: 'Users' };

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

/** Every account — customers, sellers and admins — with status, purchases and selling at a glance. */
export default async function AdminUsersPage({ searchParams }) {
  const sp = await searchParams;
  const params = { q: (sp.q ?? '').trim(), role: sp.role ?? '', page: sp.page };
  const [admin, { items, pagination, summary }] = await Promise.all([requireAdmin(), getAdminUsers(params)]);
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
        <UsersTable items={items} currentAdminId={admin.id} />
      )}

      <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath="/admin/users" params={{ q: params.q, role: params.role }} />
    </>
  );
}
