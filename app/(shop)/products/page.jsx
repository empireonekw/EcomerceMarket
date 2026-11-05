import Link from '@/components/PrefetchLink';
import { permanentRedirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import BackLink from '@/components/BackLink';
import { CategoryColumn, CategoryDrawerButton } from '@/components/CategorySidebar';
import SortMenu from '@/components/SortMenu';
import ProductGrid from '@/components/ProductGrid';
import Pagination from '@/components/Pagination';
import { categoryHref, categoryNav } from '@/lib/category-tree';
import { findCategory, getProducts } from '@/lib/data/products';
import { getCategories } from '@/lib/data/categories';
import { parseProductQuery, PRODUCT_SORTS, tagHref } from '@/lib/utils';

export async function generateMetadata({ searchParams }) {
  const { q, tag } = parseProductQuery(await searchParams);
  if (q) return { title: `Search: ${q}`, robots: { index: false } };
  // Tag filters have their own landing pages (app/(shop)/tags/[tag]): point search engines there.
  if (tag) return { title: `#${tag}`, alternates: { canonical: tagHref(tag) } };
  return {
    title: 'Browse products',
    description: `Templates, e-books, software, vectors and more from independent creators. Secure checkout and instant download.`,
    alternates: { canonical: '/products' },
  };
}

export default async function ProductsPage({ searchParams }) {
  const query = parseProductQuery(await searchParams);

  // Old /products?category=… links: categories now live at /main/sub/inner.
  if (query.category) {
    const category = await findCategory(query.category);
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: query.q, tag: query.tag, sort: query.sort === 'newest' ? undefined : query.sort })) if (v) qs.set(k, v);
    const target = category ? categoryHref(category) : '/products';
    permanentRedirect(qs.size ? `${target}?${qs}` : target);
  }

  const [{ items, pagination }, categories] = await Promise.all([getProducts(query), getCategories()]);

  // Params carried across filter/sort/page links (page itself is reset on filter change).
  const base = { q: query.q, tag: query.tag, sort: query.sort === 'newest' ? undefined : query.sort };
  const href = (overrides) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/products?${s}` : '/products';
  };

  const nav = categoryNav(categories);
  const heading = query.q ? `Results for “${query.q}”` : 'All products';

  return (
    <div className="container-wide py-6 sm:py-10">
      <div className="flex items-center gap-3">
        <BackLink fallback="/" />
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-stone-500">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            <li className="flex items-center gap-1.5">
              <ChevronRight size={14} strokeWidth={2} aria-hidden="true" className="text-stone-400" />
              {query.q ? (
                <Link href="/products" className="hover:text-ink">
                  All products
                </Link>
              ) : (
                <span aria-current="page" className="text-ink">
                  All products
                </span>
              )}
            </li>
          </ol>
        </nav>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-8 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)]">
        <CategoryColumn nav={nav} />

        <div className="min-w-0">
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h1 className="font-serif text-3xl leading-tight tracking-[-0.02em] break-words text-ink sm:text-4xl">{heading}</h1>
              <p className="mt-1 text-sm text-stone-500">
                {pagination.total.toLocaleString('en-US')} {pagination.total === 1 ? 'item' : 'items'}
                {query.tag && (
                  <>
                    {' '}
                    tagged <span className="font-medium text-ink">#{query.tag}</span> ·{' '}
                    <Link href={href({ tag: undefined })} className="underline">
                      clear
                    </Link>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <CategoryDrawerButton nav={nav} />
              <SortMenu
                current={query.sort}
                options={Object.entries(PRODUCT_SORTS).map(([key, { label }]) => ({
                  key,
                  label,
                  href: href({ sort: key === 'newest' ? undefined : key }),
                }))}
              />
            </div>
          </header>

          <div className="mt-6">
            <ProductGrid products={items} preloadCount={pagination.page === 1 ? 4 : 0} />
          </div>

          <Pagination page={pagination.page} totalPages={pagination.totalPages} params={base} />
        </div>
      </div>
    </div>
  );
}
