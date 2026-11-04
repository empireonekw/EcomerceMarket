import Link from 'next/link';
import { permanentRedirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import BackLink from '@/components/BackLink';
import ChipScroller from '@/components/ChipScroller';
import FilterChip from '@/components/FilterChip';
import ProductGrid from '@/components/ProductGrid';
import Pagination from '@/components/Pagination';
import { categoryHref } from '@/lib/category-tree';
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

  const mainCategories = categories.filter((c) => !c.parent);
  const heading = query.q ? `Results for “${query.q}”` : 'All products';

  return (
    <div className="container-page py-12 sm:py-16">
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

      <header className="mt-5">
        <h1 className="headline text-4xl sm:text-5xl">{heading}</h1>
        <p className="mt-3 text-stone-500">
          {pagination.total} {pagination.total === 1 ? 'product' : 'products'}
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
      </header>

      <div className="mt-8 space-y-3">
        <ChipScroller label="Categories">
          <FilterChip href="/products" active>
            All
          </FilterChip>
          {mainCategories.map((c) => (
            <FilterChip key={c._id} href={categoryHref(c)}>
              {c.name}
            </FilterChip>
          ))}
        </ChipScroller>

        <div className="flex items-center gap-3 border-t border-stone-100 pt-3">
          <span className="shrink-0 text-sm text-stone-500">Sort by</span>

          <ChipScroller label="Sort" bleed={false}>
            {Object.entries(PRODUCT_SORTS).map(([key, { label }]) => (
              <FilterChip key={key} href={href({ sort: key === 'newest' ? undefined : key })} active={query.sort === key}>
                {label}
              </FilterChip>
            ))}
          </ChipScroller>
        </div>
      </div>

      <div className="mt-8">
        <ProductGrid products={items} preloadCount={pagination.page === 1 ? 3 : 0} />
      </div>

      <Pagination page={pagination.page} totalPages={pagination.totalPages} params={base} />
    </div>
  );
}
