import Link from 'next/link';
import { Plus } from 'lucide-react';
import Pagination from '@/components/Pagination';
import ApprovalModeSwitch from '@/components/admin/ApprovalModeSwitch';
import { ApproveAllButton, BulkBar, BulkSelectionProvider, SelectAllProducts, SelectAllRow, SelectProduct } from '@/components/admin/BulkModeration';
import DeleteProductButton from '@/components/admin/DeleteProductButton';
import { ClearFilters, FilterMenu, SearchBox, SegmentedNav } from '@/components/admin/ListToolbar';
import ModerationActions from '@/components/admin/ModerationActions';
import PublishToggle from '@/components/admin/PublishToggle';
import { MetricCard } from '@/components/admin/analytics/KpiCard';
import { PageTitle, TABLE_HEAD } from '@/components/admin/ui';
import { PendingContent, PendingNavProvider } from '@/components/dashboard/PendingNav';
import { AdminProductsSkeleton } from '@/components/dashboard/RouteSkeletons';
import Thumb from '@/components/dashboard/Thumb';
import { EmptyState, StatusBadge, formatDateTime } from '@/components/dashboard/ui';
import VerifiedBadge from '@/components/VerifiedBadge';
import { getAdminProducts } from '@/lib/data/admin';
import { getCategories } from '@/lib/data/categories';
import { getMarketplaceSettings } from '@/lib/data/settings';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'Products' };

const STATUS_TABS = [
  { value: '', label: 'All', count: 'all' },
  { value: 'published', label: 'Live', count: 'published' },
  { value: 'pending', label: 'Awaiting review', count: 'pending' },
  { value: 'draft', label: 'Not live', count: 'draft' },
  { value: 'rejected', label: 'Rejected', count: 'rejected' },
];

/** Seller uploads need approval first; once approved, the Live/Draft switch controls visibility. */
function ProductStatusCell({ product }) {
  if (product.status === 'approved') return <PublishToggle id={product._id} title={product.title} isPublished={product.isPublished} />;
  return (
    <div className="flex flex-col items-start gap-2">
      <StatusBadge status={product.status} label={product.status === 'pending' ? 'Awaiting review' : 'Rejected'} />
      <ModerationActions id={product._id} title={product.title} />
    </div>
  );
}

const decidable = (p) => p.status === 'pending' || p.status === 'rejected';
const price = (p) => (p.price === 0 ? 'Free' : formatPrice(p.price, p.currency));

function productsHref(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/admin/products?${s}` : '/admin/products';
}

/** Admin → Products: every listing (sellers' and the platform's), with moderation, the live switch and bulk approval. */
export default async function AdminProductsPage({ searchParams }) {
  const sp = await searchParams;
  const params = { q: (sp.q ?? '').trim(), category: sp.category ?? '', status: sp.status ?? '', page: sp.page };
  const [{ items, pagination, awaitingReview, counts }, categories, settings] = await Promise.all([
    getAdminProducts(params),
    getCategories(),
    getMarketplaceSettings(),
  ]);
  const keep = { q: params.q, category: params.category, status: params.status };
  const filtered = Boolean(params.q || params.category || params.status);
  const mains = categories.filter((c) => !c.parent).sort((a, b) => a.name.localeCompare(b.name));
  const shown =
    pagination.total === 0
      ? 'No products'
      : `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total.toLocaleString('en-US')}`;

  return (
    <>
      <PageTitle
        title="Products"
        description={`${counts.all.toLocaleString('en-US')} listings in the catalog${awaitingReview ? ` · ${awaitingReview} awaiting review` : ''}`}
        actions={
          <>
            <ApproveAllButton count={awaitingReview} />
            <Link href="/admin/products/add" className="btn btn-md btn-dark">
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
              Add product
            </Link>
          </>
        }
      />

      <section aria-label="Catalog totals" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="All listings" value={counts.all.toLocaleString('en-US')} sub="Sellers’ and the platform’s" tone="brand" />
        <MetricCard
          label="Live"
          value={counts.published.toLocaleString('en-US')}
          sub="Visible in the store"
          href={productsHref({ status: 'published' })}
        />
        <MetricCard
          label="Not live"
          value={counts.draft.toLocaleString('en-US')}
          sub="Hidden by the seller or an admin"
          href={productsHref({ status: 'draft' })}
        />
        <MetricCard
          label="Awaiting review"
          value={counts.pending.toLocaleString('en-US')}
          sub={counts.pending ? 'Waiting for your decision' : 'All caught up'}
          tone="ink"
          href={productsHref({ status: 'pending' })}
        />
      </section>

      <div className="mt-4">
        <ApprovalModeSwitch autoApprove={settings.autoApproveListings} awaiting={awaitingReview} />
      </div>

      <PendingNavProvider>
        <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SegmentedNav
              label="Filter by status"
              activeKey={params.status}
              items={STATUS_TABS.map((t) => ({
                key: t.value,
                label: t.label,
                count: counts[t.count],
                href: productsHref({ ...keep, status: t.value }),
              }))}
            />
            <SearchBox action="/admin/products" params={{ ...keep, q: '' }} defaultValue={params.q} placeholder="Title, slug or tag…" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            <FilterMenu
              label="Category"
              activeKey={params.category}
              options={[
                { key: '', label: 'All categories', href: productsHref({ ...keep, category: '' }) },
                ...mains.map((c) => ({ key: String(c._id), label: c.name, href: productsHref({ ...keep, category: String(c._id) }) })),
                // A sub-category picked elsewhere (e.g. a link from the overview) still shows by name.
                ...(params.category && !mains.some((c) => String(c._id) === params.category)
                  ? categories
                      .filter((c) => String(c._id) === params.category)
                      .map((c) => ({ key: String(c._id), label: c.path ?? c.name, href: productsHref({ ...keep, category: String(c._id) }) }))
                  : []),
              ]}
            />
            {filtered && <ClearFilters href="/admin/products" />}
          </div>
        </div>

        <PendingContent fallback={<AdminProductsSkeleton />}>
          {items.length === 0 ? (
            <EmptyState title={filtered ? 'No products match these filters' : 'No products yet'}>
              <Link href="/admin/products/add" className="font-medium text-brand-700 hover:underline">
                Add a product
              </Link>
            </EmptyState>
          ) : (
            <BulkSelectionProvider selectable={items.filter(decidable).map((p) => p._id)}>
              <SelectAllRow />
              <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <p className="text-sm font-semibold text-ink">Listings</p>
                  <span className="text-xs text-stone-500">{shown}</span>
                </div>

                {/* Phones: rows, so price, status and actions are visible without horizontal scrolling. */}
                <ul className="divide-y divide-stone-100 border-t border-stone-100 md:hidden">
                  {items.map((p) => (
                    <li key={p._id} className="p-4">
                      <div className="flex items-start gap-3">
                        {decidable(p) && (
                          <span className="pt-1">
                            <SelectProduct id={p._id} title={p.title} />
                          </span>
                        )}
                        <Thumb src={p.coverImage} sizes="80px" className="aspect-[4/3] w-20 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/admin/products/${p._id}/edit`} className="line-clamp-2 text-sm font-semibold text-ink hover:underline">
                            {p.title}
                          </Link>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                            <span className="font-semibold text-ink">{price(p)}</span>
                            {p.category && <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-800">{p.category.name}</span>}
                            <span>{p.salesCount} sold</span>
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <ProductStatusCell product={p} />
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/admin/products/${p._id}/edit`}
                            className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium hover:bg-stone-100"
                          >
                            Edit
                          </Link>
                          <DeleteProductButton id={p._id} title={p.title} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Desktop: table */}
                <div className="hidden px-3 pb-3 md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className={TABLE_HEAD}>
                        <tr>
                          <th scope="col" className="w-10 pr-0 pl-3">
                            <SelectAllProducts className="align-middle" />
                          </th>
                          <th scope="col" className="w-full px-3">
                            Product
                          </th>
                          <th scope="col" className="hidden px-3 lg:table-cell">
                            Category
                          </th>
                          <th scope="col" className="px-3 text-right">
                            Price
                          </th>
                          <th scope="col" className="px-3">
                            Status
                          </th>
                          <th scope="col" className="hidden px-3 text-right xl:table-cell">
                            Sales
                          </th>
                          <th scope="col" className="hidden px-3 2xl:table-cell">
                            Added
                          </th>
                          <th scope="col" className="pr-3 text-right">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {items.map((p) => {
                          const created = formatDateTime(p.createdAt);
                          return (
                            <tr key={p._id} className="transition-colors hover:bg-stone-50/80">
                              <td className="py-3 pr-0 pl-3">{decidable(p) && <SelectProduct id={p._id} title={p.title} />}</td>
                              <td className="max-w-0 min-w-52 px-3 py-3">
                                <div className="flex items-center gap-3">
                                  <Thumb src={p.coverImage} sizes="56px" className="aspect-[4/3] w-14 rounded-lg" />
                                  <div className="min-w-0">
                                    <Link
                                      href={`/admin/products/${p._id}/edit`}
                                      className="line-clamp-1 font-semibold text-ink hover:underline"
                                      title={p.title}
                                    >
                                      {p.title}
                                    </Link>
                                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-stone-500">
                                      <span className="font-medium text-brand-800">{p.sellerId?.seller?.storeName ?? 'Platform'}</span>
                                      {p.sellerId?.seller?.verification?.status === 'verified' && <VerifiedBadge size={12} />}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden px-3 py-3 whitespace-nowrap lg:table-cell">
                                {p.category ? (
                                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">{p.category.name}</span>
                                ) : (
                                  <span className="text-xs text-stone-400">None</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums text-ink">{price(p)}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <ProductStatusCell product={p} />
                              </td>
                              <td className="hidden px-3 py-3 text-right tabular-nums text-stone-600 xl:table-cell">
                                {p.salesCount.toLocaleString('en-US')}
                              </td>
                              <td className="hidden px-3 py-3 whitespace-nowrap text-stone-600 2xl:table-cell">
                                {created.date}
                                <span className="block text-xs text-stone-400">{created.time}</span>
                              </td>
                              <td className="py-3 pr-3 whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  {p.isPublished && p.status === 'approved' && (
                                    <a
                                      href={`/products/${p.slug}`}
                                      target="_blank"
                                      rel="noopener"
                                      className="hidden h-8 items-center rounded-lg px-3 text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-ink xl:inline-flex"
                                    >
                                      View
                                    </a>
                                  )}
                                  <Link
                                    href={`/admin/products/${p._id}/edit`}
                                    className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium hover:bg-stone-100"
                                  >
                                    Edit
                                  </Link>
                                  <DeleteProductButton id={p._id} title={p.title} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
              <BulkBar />
            </BulkSelectionProvider>
          )}

          <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath="/admin/products" params={keep} />
        </PendingContent>
      </PendingNavProvider>
    </>
  );
}
