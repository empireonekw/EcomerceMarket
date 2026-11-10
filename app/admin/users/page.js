import Pagination from '@/components/Pagination';
import IdReviewQueue from '@/components/admin/IdReviewQueue';
import UsersTable from '@/components/admin/UsersTable';
import { ClearFilters, FilterMenu, SearchBox, SegmentedNav } from '@/components/admin/ListToolbar';
import { MetricCard } from '@/components/admin/analytics/KpiCard';
import { PageTitle } from '@/components/admin/ui';
import { PendingContent, PendingNavProvider } from '@/components/dashboard/PendingNav';
import { AdminUsersListSkeleton } from '@/components/dashboard/RouteSkeletons';
import { EmptyState } from '@/components/dashboard/ui';
import { requireAdmin } from '@/lib/auth';
import { ACCOUNT_FILTERS, getAdminUsers, VERIFICATION_FILTERS } from '@/lib/data/admin-users';

export const metadata = { title: 'Users' };

const ROLE_TABS = [
  { value: '', label: 'All', key: 'total' },
  { value: 'customer', label: 'Shoppers', key: 'customer' },
  { value: 'seller', label: 'Sellers', key: 'seller' },
  { value: 'admin', label: 'Admins', key: 'admin' },
];

/** /admin/users with these params (empty ones dropped). */
function usersHref(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/admin/users?${s}` : '/admin/users';
}

/** Every account (shoppers, sellers, admins) with status, purchases and selling at a glance; the ID review queue. */
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
    status: ACCOUNT_FILTERS.some((f) => f.value === sp.status) ? sp.status : '',
  };
  const [admin, { items, pagination, summary }] = await Promise.all([requireAdmin(), getAdminUsers(params)]);
  // Every filter, kept when another one changes (the page resets).
  const keep = {
    role: params.role,
    q: params.q,
    joined: params.joined,
    from: params.from,
    to: params.to,
    verification: params.verification,
    status: params.status,
  };
  const filtered = Object.values(keep).some(Boolean);
  const reviewQueue = params.verification === 'pending';
  const joinedKey = params.joined === 'today' || params.joined === 'yesterday' ? params.joined : params.from || params.to ? 'range' : '';
  const shown =
    pagination.total === 0
      ? 'No accounts'
      : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total.toLocaleString('en-US')}`;

  return (
    <>
      <PageTitle
        title="Users"
        description={`${summary.total.toLocaleString('en-US')} accounts · ${summary.newToday} new today, ${summary.newYesterday} yesterday`}
      />

      <section aria-label="User totals" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Total users"
          value={summary.total.toLocaleString('en-US')}
          sub={`${summary.newLast30d.toLocaleString('en-US')} joined in the last 30 days`}
          tone="brand"
        />
        <MetricCard
          label="Shoppers"
          value={summary.byRole.customer.toLocaleString('en-US')}
          sub={summary.stuckShoppers ? `${summary.stuckShoppers} part-way through opening a shop` : 'Shopping accounts'}
          href={usersHref({ role: 'customer' })}
        />
        <MetricCard
          label="Sellers"
          value={summary.byRole.seller.toLocaleString('en-US')}
          sub={summary.setupPending ? `${summary.setupPending} haven’t opened their shop` : 'All shops open'}
          href={usersHref({ role: 'seller' })}
        />
        <MetricCard
          label="IDs to review"
          value={summary.idsToReview.toLocaleString('en-US')}
          sub={summary.idsToReview ? 'Waiting for your check' : 'All caught up'}
          tone="ink"
          href={usersHref({ verification: 'pending' })}
        />
      </section>

      {/* Tabs, search and filters switch instantly; the list shows a skeleton until the new results arrive. */}
      <PendingNavProvider>
        <div className="mt-4 mb-4 rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SegmentedNav
              label="Filter by role"
              activeKey={params.role}
              items={ROLE_TABS.map((t) => ({
                key: t.value,
                label: t.label,
                count: t.key === 'total' ? summary.total : summary.byRole[t.key],
                href: usersHref({ ...keep, role: t.value }),
              }))}
            />
            <SearchBox action="/admin/users" params={{ ...keep, q: '' }} defaultValue={params.q} placeholder="Name, email or shop…" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            <FilterMenu
              label="ID check"
              activeKey={params.verification}
              options={[
                { key: '', label: 'Any', href: usersHref({ ...keep, verification: '' }) },
                { key: 'pending', label: 'To review', count: summary.idsToReview, href: usersHref({ ...keep, verification: 'pending' }) },
                { key: 'verified', label: 'Verified', href: usersHref({ ...keep, verification: 'verified' }) },
                { key: 'rejected', label: 'Rejected', href: usersHref({ ...keep, verification: 'rejected' }) },
              ]}
            />
            <FilterMenu
              label="Needs attention"
              activeKey={params.status}
              options={[
                { key: '', label: 'Any', href: usersHref({ ...keep, status: '' }) },
                ...ACCOUNT_FILTERS.map((f) => ({
                  key: f.value,
                  label: f.label,
                  count: { setup: summary.setupPending, wizard: summary.stuckShoppers, payout: summary.payoutMissing }[f.value],
                  href: usersHref({ ...keep, status: f.value }),
                })),
              ]}
            />
            <FilterMenu
              label="Joined"
              activeKey={joinedKey}
              options={[
                { key: '', label: 'Any time', href: usersHref({ ...keep, joined: '', from: '', to: '' }) },
                { key: 'today', label: 'Today', count: summary.newToday, href: usersHref({ ...keep, joined: 'today', from: '', to: '' }) },
                {
                  key: 'yesterday',
                  label: 'Yesterday',
                  count: summary.newYesterday,
                  href: usersHref({ ...keep, joined: 'yesterday', from: '', to: '' }),
                },
              ]}
              range={{
                from: params.from,
                to: params.to,
                max: summary.today,
                action: '/admin/users',
                params: { ...keep, joined: '', from: '', to: '' },
              }}
            />
            {filtered && <ClearFilters href="/admin/users" />}
          </div>
        </div>

        <PendingContent fallback={<AdminUsersListSkeleton />}>
          {items.length === 0 ? (
            <EmptyState title={reviewQueue ? 'No IDs waiting for review' : filtered ? 'No users match these filters' : 'No users yet'}>
              {reviewQueue ? 'New identity checks appear here after a seller’s first sale.' : null}
            </EmptyState>
          ) : reviewQueue ? (
            <IdReviewQueue items={items} />
          ) : (
            <UsersTable items={items} currentAdminId={admin.id} summary={shown} />
          )}

          <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath="/admin/users" params={keep} />
        </PendingContent>
      </PendingNavProvider>
    </>
  );
}
