import Link from 'next/link';
import { Store, UserPlus, Users, UserRound } from 'lucide-react';
import Pagination from '@/components/Pagination';
import JoinedFilter from '@/components/admin/JoinedFilter';
import UsersTable from '@/components/admin/UsersTable';
import { FilterTabs, PendingContent, PendingNavProvider, PendingSearchForm } from '@/components/dashboard/PendingNav';
import { AdminUsersListSkeleton } from '@/components/dashboard/RouteSkeletons';
import { PageHeader, StatCard, EmptyState, buttonClasses } from '@/components/dashboard/ui';
import { requireAdmin } from '@/lib/auth';
import { getAdminUsers, VERIFICATION_FILTERS } from '@/lib/data/admin-users';
import VerifiedBadge from '@/components/VerifiedBadge';

export const metadata = { title: 'Users' };

const field = 'h-11 rounded-full border border-stone-300 bg-white px-4 text-sm focus:border-black focus:outline-none';

const VERIFICATION_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'To review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

const ROLE_TABS = [
  { value: '', label: 'All users', key: 'total' },
  { value: 'customer', label: 'Customers', key: 'customer' },
  { value: 'seller', label: 'Sellers', key: 'seller' },
  { value: 'admin', label: 'Admins', key: 'admin' },
];

function tabHref(role, q, dates = {}) {
  const qs = new URLSearchParams();
  if (role) qs.set('role', role);
  if (q) qs.set('q', q);
  for (const [k, v] of Object.entries(dates)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/admin/users?${s}` : '/admin/users';
}

/** Every account — customers, sellers and admins — with status, purchases and selling at a glance. */
export default async function AdminUsersPage({ searchParams }) {
  const sp = await searchParams;
  const params = {
    q: (sp.q ?? '').trim(),
    role: sp.role ?? '',
    page: sp.page,
    joined: sp.joined ?? '',
    from: sp.from ?? '',
    to: sp.to ?? '',
    verification: VERIFICATION_FILTERS.includes(sp.verification) ? sp.verification : '',
  };
  const [admin, { items, pagination, summary }] = await Promise.all([requireAdmin(), getAdminUsers(params)]);
  // Filters kept when switching tabs, searching or paging (the ID check one included).
  const dates = { joined: params.joined, from: params.from, to: params.to, verification: params.verification };
  const filtered = Boolean(params.q || params.role || params.joined || params.from || params.to || params.verification);

  return (
    <>
      <PageHeader
        title="Users"
        description={`${pagination.total} account${pagination.total === 1 ? '' : 's'}${filtered ? ' match your filters' : ''} · newest first${
          pagination.totalPages > 1
            ? ` · showing ${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} (page ${pagination.page} of ${pagination.totalPages})`
            : ''
        }`}
      />

      <section aria-label="User totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={summary.total.toLocaleString('en-US')} sub={`${summary.byRole.admin} admin${summary.byRole.admin === 1 ? '' : 's'}`} icon={Users} />
        <StatCard label="Customers" value={summary.byRole.customer.toLocaleString('en-US')} sub="Shopping accounts" icon={UserRound} tone="info" />
        <StatCard
          label="Sellers"
          value={summary.byRole.seller.toLocaleString('en-US')}
          sub={
            summary.idsToReview
              ? `${summary.idsToReview} ID${summary.idsToReview === 1 ? '' : 's'} to review`
              : summary.setupPending
                ? `${summary.setupPending} haven’t set up a shop`
                : 'All shops set up'
          }
          icon={Store}
          tone={summary.idsToReview || summary.setupPending ? 'warning' : 'positive'}
        />
        <StatCard label="New in 30 days" value={summary.newLast30d.toLocaleString('en-US')} sub="Sign-ups this month" icon={UserPlus} tone="positive" />
      </section>

      {/* Tabs and search switch instantly; the list shows a skeleton until the new results arrive. */}
      <PendingNavProvider>
        <div className="mb-5 mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterTabs
            label="Filter by role"
            activeKey={params.role}
            items={ROLE_TABS.map((t) => ({
              key: t.value,
              label: t.label,
              count: t.key === 'total' ? summary.total : summary.byRole[t.key],
              href: tabHref(t.value, params.q, dates),
            }))}
          />

          <PendingSearchForm
            action="/admin/users"
            params={{ role: params.role, ...dates }}
            defaultValue={params.q}
            label="Search users"
            placeholder="Name, email or shop…"
            inputClassName={`${field} w-full lg:w-72`}
            buttonClassName={buttonClasses.secondary}
          />
        </div>

        {/* ID check (sellers who sent their ID after their first sale): to review / verified / rejected. */}
        <nav aria-label="Filter by ID check" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">ID check:</span>
          {VERIFICATION_TABS.map((t) => (
            <Link
              key={t.value}
              href={tabHref(params.role, params.q, { ...dates, verification: t.value })}
              aria-current={params.verification === t.value ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition-colors ${
                params.verification === t.value ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-ink'
              }`}
            >
              {t.value === 'verified' && <VerifiedBadge size={14} decorative />}
              {t.label}
              {t.value === 'pending' && summary.idsToReview > 0 && (
                <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-medium leading-4 text-ink">{summary.idsToReview}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="mb-5">
          <JoinedFilter
            base={{ role: params.role, q: params.q, verification: params.verification }}
            joined={params.joined}
            from={params.from}
            to={params.to}
            counts={{ today: summary.newToday, yesterday: summary.newYesterday }}
            today={summary.today}
          />
        </div>

        <PendingContent fallback={<AdminUsersListSkeleton />}>
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

          <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath="/admin/users" params={{ q: params.q, role: params.role, ...dates }} />
        </PendingContent>
      </PendingNavProvider>
    </>
  );
}
