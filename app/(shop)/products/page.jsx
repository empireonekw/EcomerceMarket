import Link from 'next/link';
import ProductGrid from '@/components/ProductGrid';
import Pagination from '@/components/Pagination';
import { getProducts } from '@/lib/data/products';
import { getCategories } from '@/lib/data/categories';
import { parseProductQuery, PRODUCT_SORTS } from '@/lib/utils';

export async function generateMetadata({ searchParams }) {
  const { q, category } = parseProductQuery(await searchParams);
  if (q) return { title: `Search: ${q}`, robots: { index: false } };
  if (category) {
    const categories = await getCategories();
    const match = categories.find((c) => c.slug === category);
    if (match) return { title: match.name, description: match.description };
  }
  return { title: 'Browse products' };
}

function Chip({ href, active, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-ink'
      }`}
    >
      {children}
    </Link>
  );
}

export default async function ProductsPage({ searchParams }) {
  const query = parseProductQuery(await searchParams);
  const [{ items, pagination }, categories] = await Promise.all([getProducts(query), getCategories()]);

  // Params carried across filter/sort/page links (page itself is reset on filter change).
  const base = { q: query.q, category: query.category, tag: query.tag, sort: query.sort === 'newest' ? undefined : query.sort };
  const href = (overrides) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/products?${s}` : '/products';
  };

  const activeCategory = categories.find((c) => c.slug === query.category);
  const mainCategories = categories.filter((c) => !c.parent);
  // Sub-category chips: everything under the selected category's main category.
  const activeRoot = activeCategory && (activeCategory.ancestors[0] ?? activeCategory._id);
  const subCategories = activeRoot ? categories.filter((c) => c.ancestors.includes(activeRoot)) : [];
  const heading = query.q ? `Results for “${query.q}”` : activeCategory?.name ?? 'All products';

  return (
    <div className="container-page py-12 sm:py-16">
      <header>
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

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <Chip href={href({ category: undefined })} active={!query.category}>
            All
          </Chip>
          {mainCategories.map((c) => (
            <Chip key={c._id} href={href({ category: c.slug })} active={c._id === activeRoot}>
              {c.name}
            </Chip>
          ))}
        </nav>

        <nav aria-label="Sort" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {Object.entries(PRODUCT_SORTS).map(([key, { label }]) => (
            <Chip key={key} href={href({ sort: key === 'newest' ? undefined : key })} active={query.sort === key}>
              {label}
            </Chip>
          ))}
        </nav>
      </div>

      {subCategories.length > 0 && (
        <nav aria-label="Sub-categories" className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {subCategories.map((c) => (
            <Chip key={c._id} href={href({ category: c.slug })} active={c.slug === query.category}>
              {c.depth > 1 ? `› ${c.name}` : c.name}
            </Chip>
          ))}
        </nav>
      )}

      <div className="mt-8">
        <ProductGrid products={items} preloadCount={pagination.page === 1 ? 3 : 0} />
      </div>

      <Pagination page={pagination.page} totalPages={pagination.totalPages} params={base} />
    </div>
  );
}
