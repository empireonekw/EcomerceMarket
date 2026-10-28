import { ChartSkeleton, DashboardPageSkeleton, FilterBarSkeleton, HeaderSkeleton, PanelSkeleton, StatsSkeleton, TableSkeleton } from '@/components/dashboard/Skeletons';

// One loading skeleton per dashboard page. Used twice, so both always match:
//  - by each route's loading.jsx (shown by Next.js while the page streams in), and
//  - by DashboardShell the moment a sidebar link is clicked (skeletonFor), before the server has answered.

const bar = 'rounded-full bg-stone-200/80';

export function AdminOverviewSkeleton() {
  return (
    <DashboardPageSkeleton>
      <HeaderSkeleton action />
      <StatsSkeleton />
      <div className="mt-4">
        <StatsSkeleton count={3} />
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={5} />
      </div>
    </DashboardPageSkeleton>
  );
}

export function AdminProductsSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading products">
      <HeaderSkeleton action />
      <FilterBarSkeleton />
      <TableSkeleton rows={10} cols={5} thumb={true} />
    </DashboardPageSkeleton>
  );
}

/** Users table only (bulk bar + rows) — shown in place while a role tab or search loads. */
export function AdminUsersListSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading users">
      <div className="mb-3 flex h-12 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4">
        <div className="size-4 rounded bg-stone-200/80" />
        <div className={`h-3.5 w-36 ${bar}`} />
      </div>
      <TableSkeleton rows={8} cols={7} thumb={false} />
    </DashboardPageSkeleton>
  );
}

export function AdminUsersSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading users">
      <HeaderSkeleton />
      <StatsSkeleton />
      <FilterBarSkeleton />
      <AdminUsersListSkeleton />
    </DashboardPageSkeleton>
  );
}

export function AdminUserSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading user">
      <div className={`h-4 w-20 ${bar}`} />
      <div className="mb-8 mt-4 flex items-center gap-4">
        <div className="size-14 rounded-full bg-stone-200/80" />
        <div>
          <div className={`h-9 w-64 ${bar}`} />
          <div className={`mt-3 h-4 w-80 max-w-full ${bar}`} />
        </div>
      </div>
      <StatsSkeleton />
      <div className="mt-8">
        <ChartSkeleton />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={6} />
      </div>
    </DashboardPageSkeleton>
  );
}

/** Categories: form card on the left, table on the right. */
export function AdminCategoriesSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading categories">
      <HeaderSkeleton />
      <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6">
          <div className={`h-6 w-44 ${bar}`} />
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className={`h-3.5 w-20 ${bar}`} />
              <div className={`mt-2 ${i === 4 ? 'h-24' : 'h-11'} rounded-xl bg-stone-200/80`} />
            </div>
          ))}
          <div className="h-10 w-40 rounded-full bg-stone-200/80" />
        </div>
        <div>
          <div className="mb-3 flex justify-between">
            <div className="h-10 w-52 rounded-full bg-stone-200/80" />
            <div className="h-10 w-64 rounded-full bg-stone-200/80" />
          </div>
          <TableSkeleton rows={8} cols={4} thumb={false} />
        </div>
      </div>
    </DashboardPageSkeleton>
  );
}

export function AdminOrdersSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading orders">
      <HeaderSkeleton action />
      <FilterBarSkeleton />
      <TableSkeleton rows={10} cols={5} thumb={false} />
    </DashboardPageSkeleton>
  );
}

export function AdminPayoutsSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading payouts">
      <HeaderSkeleton />
      <StatsSkeleton />
      <div className="mt-8">
        <TableSkeleton rows={6} cols={5} thumb={false} />
      </div>
      <div className="mt-8">
        <PanelSkeleton rows={4} />
      </div>
    </DashboardPageSkeleton>
  );
}

export function AdminMessagesSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading messages">
      <HeaderSkeleton />
      <FilterBarSkeleton />
      <PanelSkeleton rows={6} />
    </DashboardPageSkeleton>
  );
}

/** Add / edit product (admin and seller): mirrors ProductForm's sections and sidebar. */
export function ProductFormSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading product form">
      <HeaderSkeleton />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem] xl:items-start">
        <div className="space-y-6">
          {[3, 2, 3, 3].map((fields, i) => (
            <div key={i} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
              <div className={`h-4 w-28 ${bar}`} />
              <div className={`mt-2 h-3 w-64 max-w-full ${bar}`} />
              <div className="mt-5 space-y-5">
                {Array.from({ length: fields }, (_, f) => (
                  <div key={f}>
                    <div className={`h-3.5 w-24 ${bar}`} />
                    <div className="mt-2 h-11 rounded-xl bg-stone-200/80" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <PanelSkeleton rows={3} />
          <div className="rounded-2xl border border-stone-200 bg-white p-3">
            <div className="aspect-[4/3] rounded-xl bg-stone-200/80" />
            <div className={`mt-3 h-4 w-3/4 ${bar}`} />
            <div className={`mt-2 h-4 w-16 ${bar}`} />
          </div>
          <div className="h-12 rounded-full bg-stone-200/80" />
        </div>
      </div>
    </DashboardPageSkeleton>
  );
}

export function SellerDashboardSkeleton() {
  return (
    <DashboardPageSkeleton>
      <HeaderSkeleton action />
      <StatsSkeleton />
      <div className="mt-8">
        <ChartSkeleton />
      </div>
      <div className="mt-8">
        <TableSkeleton rows={4} cols={5} />
      </div>
    </DashboardPageSkeleton>
  );
}

export function SellerListingsSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading your listings">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className={`h-9 w-36 ${bar}`} />
        <div className="flex gap-3">
          <div className="hidden h-11 w-72 rounded-full bg-stone-200/80 sm:block" />
          <div className="h-11 w-36 rounded-full bg-stone-200/80" />
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_15rem] xl:grid-cols-[1fr_16rem]">
        <div>
          <div className="mb-5 flex gap-2">
            {[28, 20, 24, 18].map((w, i) => (
              <div key={i} className="h-9 rounded-full bg-stone-200/80" style={{ width: `${w * 4}px` }} />
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <div className="aspect-[4/3] bg-stone-200/80" />
                <div className="space-y-2.5 p-4">
                  <div className={`h-4 w-4/5 ${bar}`} />
                  <div className={`h-3.5 w-16 ${bar}`} />
                  <div className={`h-5 w-20 ${bar}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden space-y-5 lg:block">
          <div className={`h-7 w-24 ${bar}`} />
          <div className="h-11 rounded-xl bg-stone-200/80" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`h-4 w-32 ${bar}`} />
          ))}
        </div>
      </div>
    </DashboardPageSkeleton>
  );
}

/** New / edit listing: breadcrumb, title, section tabs and the first section cards. */
export function ListingFormSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading listing form">
      <div>
        <div className={`h-3.5 w-32 ${bar}`} />
        <div className={`mt-4 h-9 w-48 ${bar}`} />
        <div className="mt-8 flex gap-7 border-b border-stone-200 pb-4">
          {[16, 24, 32, 26, 36, 18].map((w, i) => (
            <div key={i} className={`h-4 shrink-0 ${bar}`} style={{ width: `${w * 4}px` }} />
          ))}
        </div>
        <div className="mt-8 space-y-6">
          {[1, 3].map((fields, i) => (
            <div key={i} className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
              <div className={`h-6 w-40 ${bar}`} />
              <div className={`mt-2 h-3.5 w-72 max-w-full ${bar}`} />
              <div className="mt-7 space-y-6">
                {Array.from({ length: fields }, (_, f) => (
                  <div key={f}>
                    <div className={`h-4 w-28 ${bar}`} />
                    <div className={`mt-3 ${i === 0 ? 'h-36' : 'h-12'} max-w-2xl rounded-xl bg-stone-200/80`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardPageSkeleton>
  );
}

export function SellerSalesSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading sales">
      <HeaderSkeleton />
      <StatsSkeleton />
      <FilterBarSkeleton />
      <TableSkeleton rows={10} cols={7} thumb={false} />
    </DashboardPageSkeleton>
  );
}

export function SellerPayoutsSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading payouts">
      <HeaderSkeleton />
      <StatsSkeleton count={3} />
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={4} />
      </div>
    </DashboardPageSkeleton>
  );
}

/** Inbox: header with search, folder column, toolbar and conversation rows (full-bleed like the page). */
export function SellerMessagesSkeleton() {
  return (
    <DashboardPageSkeleton label="Loading messages">
      <div className="-mx-4 -my-6 min-h-dvh sm:-mx-6 lg:-mx-10 lg:-my-10">
        <div className="flex items-center gap-6 border-b border-stone-200 px-4 py-5 sm:px-8">
          <div className={`h-8 w-36 ${bar}`} />
          <div className="ml-auto hidden h-12 w-full max-w-xl rounded-full bg-stone-200/80 sm:block" />
          <div className={`h-5 w-36 ${bar}`} />
        </div>
        <div className="flex">
          <div className="hidden w-64 shrink-0 space-y-5 border-r border-stone-200 px-9 py-8 md:block lg:w-72">
            {[14, 18, 32, 26, 12, 8, 16, 12, 28].map((w, i) => (
              <div key={i} className={`h-4 ${bar}`} style={{ width: `${w * 4}px` }} />
            ))}
          </div>
          <div className="flex-1">
            <div className="flex h-16 items-center gap-6 border-b border-stone-200 px-5">
              <div className="size-5 rounded bg-stone-200/80" />
              {[24, 24, 20, 14, 16, 12].map((w, i) => (
                <div key={i} className={`h-4 ${bar}`} style={{ width: `${w * 4}px` }} />
              ))}
            </div>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-stone-200 px-5 py-4">
                <div className="size-5 rounded bg-stone-200/80" />
                <div className="size-10 rounded-full bg-stone-200/80" />
                <div className="flex-1 space-y-2">
                  <div className={`h-3.5 w-40 ${bar}`} />
                  <div className={`h-3 w-3/4 ${bar}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardPageSkeleton>
  );
}

const isProductForm = (p, base) => p === `${base}/add` || (p.startsWith(`${base}/`) && p.endsWith('/edit'));

/** The skeleton of the dashboard page at `pathname`, or null when there isn't one. */
export function skeletonFor(pathname) {
  const p = pathname.replace(/\/$/, '');
  if (p === '/admin') return AdminOverviewSkeleton;
  if (isProductForm(p, '/admin/products')) return ProductFormSkeleton;
  if (p === '/seller/listings/new' || (p.startsWith('/seller/listings/') && p.endsWith('/edit'))) return ListingFormSkeleton;
  if (p === '/admin/products') return AdminProductsSkeleton;
  if (p === '/admin/users') return AdminUsersSkeleton;
  if (p.startsWith('/admin/users/')) return AdminUserSkeleton;
  if (p === '/admin/categories') return AdminCategoriesSkeleton;
  if (p === '/admin/orders') return AdminOrdersSkeleton;
  if (p === '/admin/payouts') return AdminPayoutsSkeleton;
  if (p === '/admin/messages') return AdminMessagesSkeleton;
  if (p === '/seller/dashboard') return SellerDashboardSkeleton;
  if (p === '/seller/listings') return SellerListingsSkeleton;
  if (p === '/seller/sales') return SellerSalesSkeleton;
  if (p === '/seller/payouts') return SellerPayoutsSkeleton;
  if (p === '/seller/messages') return SellerMessagesSkeleton;
  return null;
}
