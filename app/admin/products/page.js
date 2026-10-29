import Link from 'next/link';
import Form from 'next/form';
import { Search } from 'lucide-react';
import Pagination from '@/components/Pagination';
import DeleteProductButton from '@/components/admin/DeleteProductButton';
import PublishToggle from '@/components/admin/PublishToggle';
import ModerationActions from '@/components/admin/ModerationActions';
import Thumb from '@/components/dashboard/Thumb';
import { PageHeader, StatusBadge, EmptyState, formatDateTime } from '@/components/dashboard/ui';
import { getAdminProducts } from '@/lib/data/admin';
import { getCategories } from '@/lib/data/categories';
import { formatPrice } from '@/lib/utils';

export const metadata = { title: 'Products' };

/** Seller uploads need approval first; once approved, the Live/Draft switch controls visibility. */
function ProductStatusCell({ product }) {
  if (product.status === 'approved') return <PublishToggle id={product._id} title={product.title} isPublished={product.isPublished} />;
  return (
    <div className="flex flex-col items-start gap-1.5">
      <StatusBadge status={product.status} label={product.status === 'pending' ? 'Awaiting review' : 'Rejected'} />
      <ModerationActions id={product._id} title={product.title} />
    </div>
  );
}

const field = 'h-10 rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm transition-colors hover:border-stone-300 focus:border-ink focus:bg-white focus:outline-none';

export default async function AdminProductsPage({ searchParams }) {
  const sp = await searchParams;
  const params = { q: sp.q ?? '', category: sp.category ?? '', status: sp.status ?? '', page: sp.page };
  const [{ items, pagination }, categories] = await Promise.all([getAdminProducts(params), getCategories()]);
  const filtered = Boolean(params.q || params.category || params.status);

  return (
    <>
      <PageHeader
        title="Products Management"
        description={`${pagination.total} product${pagination.total === 1 ? '' : 's'}${filtered ? ' match your filters' : ' in the catalog'}`}
      />

      {/* Filters: plain GET form → URL state, shareable and back-button friendly. */}
      <Form action="/admin/products" className="mb-5 flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <label htmlFor="q" className="sr-only">
          Search products
        </label>
        <div className="relative sm:min-w-64 sm:flex-1">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400" />
          <input id="q" name="q" type="search" defaultValue={params.q} placeholder="Search title, slug or tag…" className={`${field} w-full pl-10`} />
        </div>
        <label htmlFor="category" className="sr-only">
          Category
        </label>
        <select id="category" name="category" defaultValue={params.category} className={field}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.path ?? c.name}
            </option>
          ))}
        </select>
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select id="status" name="status" defaultValue={params.status} className={field}>
          <option value="">Any status</option>
          <option value="published">Live</option>
          <option value="draft">Draft</option>
          <option value="pending">Awaiting review</option>
          <option value="rejected">Rejected</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-dark h-10 rounded-xl px-5 text-sm">
            Filter
          </button>
          {filtered && (
            <Link href="/admin/products" className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-ink">
              Clear
            </Link>
          )}
        </div>
      </Form>

      {items.length === 0 ? (
        <EmptyState title={filtered ? 'No products match these filters' : 'No products yet'}>
          <Link href="/admin/products/add" className="font-medium text-brand-700 hover:underline">
            Add your first product →
          </Link>
        </EmptyState>
      ) : (
        <>
        {/* Phones: card list, so price, status and actions are visible without horizontal scrolling. */}
        <ul className="space-y-3 md:hidden">
          {items.map((p) => (
            <li key={p._id} className="rounded-2xl border border-stone-200 bg-white p-3">
              <div className="flex gap-3">
                <Thumb src={p.coverImage} sizes="80px" className="aspect-[4/3] w-20" />
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/products/${p._id}/edit`} className="line-clamp-2 text-sm font-medium hover:underline">
                    {p.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span className="font-medium text-ink">{p.price === 0 ? 'Free' : formatPrice(p.price, p.currency)}</span>
                    {p.category && <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{p.category.name}</span>}
                    <span>{p.salesCount} sold</span>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                <ProductStatusCell product={p} />
                <div className="flex items-center gap-1">
                  <Link href={`/admin/products/${p._id}/edit`} className="inline-flex h-8 items-center rounded-full px-3 text-sm font-medium hover:bg-stone-100">
                    Edit
                  </Link>
                  <DeleteProductButton id={p._id} title={p.title} />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-stone-100 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                <tr>
                  <th scope="col" className="w-full px-4 py-3">Product</th>
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Category</th>
                  <th scope="col" className="px-4 py-3 text-right">Price</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="hidden px-4 py-3 text-right lg:table-cell">Sales</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Created</th>
                  <th scope="col" className="px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 [&_td]:py-3.5">
                {items.map((p) => {
                  const created = formatDateTime(p.createdAt);
                  return (
                    <tr key={p._id} className="transition-colors hover:bg-brand-50/50">
                      <td className="max-w-0 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumb src={p.coverImage} sizes="64px" className="aspect-[4/3] w-16 rounded-xl" />
                          <div className="min-w-0">
                            <Link href={`/admin/products/${p._id}/edit`} className="block truncate font-medium hover:underline" title={p.title}>
                              {p.title}
                            </Link>
                            <p className="mt-0.5 truncate text-xs text-stone-500" title={`/${p.slug}`}>
                              <span className="font-medium text-stone-600">{p.sellerId?.seller?.storeName ?? 'Platform'}</span> · /{p.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">
                        {p.category ? (
                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">{p.category.name}</span>
                        ) : (
                          <span className="text-xs text-stone-400">–</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{p.price === 0 ? 'Free' : formatPrice(p.price, p.currency)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <ProductStatusCell product={p} />
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-stone-600 lg:table-cell">{p.salesCount.toLocaleString('en-US')}</td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-stone-600 lg:table-cell">
                        {created.date}
                        <span className="block text-xs text-stone-400">{created.time}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {p.isPublished && p.status === 'approved' && (
                            <a
                              href={`/products/${p.slug}`}
                              target="_blank"
                              rel="noopener"
                              className="hidden h-8 items-center rounded-full px-3 text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-ink xl:inline-flex"
                            >
                              View
                            </a>
                          )}
                          <Link
                            href={`/admin/products/${p._id}/edit`}
                            className="inline-flex h-8 items-center rounded-full px-3 text-sm font-medium hover:bg-stone-100"
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
        </>
      )}

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        basePath="/admin/products"
        params={{ q: params.q, category: params.category, status: params.status }}
      />
    </>
  );
}
