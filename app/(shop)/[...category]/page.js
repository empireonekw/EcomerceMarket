import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import FilterChip from '@/components/FilterChip';
import Pagination from '@/components/Pagination';
import ProductGrid from '@/components/ProductGrid';
import { categoryHref } from '@/lib/category-tree';
import { getCategories } from '@/lib/data/categories';
import { getProducts } from '@/lib/data/products';
import { siteConfig } from '@/lib/site';
import { parseProductQuery, PRODUCT_SORTS } from '@/lib/utils';

/** The category at /main/sub/inner (slugs are only unique among siblings, so the whole path identifies it). */
async function categoryFor(segments) {
  const path = (segments ?? []).map((s) => decodeURIComponent(s).toLowerCase()).join('/');
  const categories = await getCategories();
  const category = categories.find((c) => c.slugPath === path);
  return category ? { category, categories } : null;
}

export async function generateMetadata({ params }) {
  const { category: segments } = await params;
  const found = await categoryFor(segments);
  if (!found) return { title: 'Page not found', robots: { index: false } };
  const { category } = found;
  const title = category.metaTitle || category.name;
  const description =
    category.metaDescription || category.description || `Shop ${category.name} from independent creators on ${siteConfig.name}. Instant downloads.`;
  return {
    title,
    description,
    alternates: { canonical: categoryHref(category) },
    openGraph: { type: 'website', title, description, url: categoryHref(category) },
  };
}

/**
 * Category page — /main, /main/sub or /main/sub/inner (SEO-friendly URLs). Shows the category and everything in
 * its sub-categories, with breadcrumbs, sub-category chips, sorting and pagination.
 */
export default async function CategoryPage({ params, searchParams }) {
  const { category: segments } = await params;
  const found = await categoryFor(segments);
  if (!found) notFound();
  const { category, categories } = found;

  const query = parseProductQuery(await searchParams);
  const { items, pagination } = await getProducts({ ...query, category: category._id });

  const byId = new Map(categories.map((c) => [c._id, c]));
  const trail = [...category.ancestors.map((id) => byId.get(id)).filter(Boolean), category];
  const children = categories.filter((c) => c.parent === category._id);
  // A category without sub-categories shows its siblings instead, so shoppers can move sideways.
  const chips = children.length ? children : category.parent ? categories.filter((c) => c.parent === category.parent) : [];
  const parent = category.parent ? byId.get(category.parent) : null;

  const base = { tag: query.tag, sort: query.sort === 'newest' ? undefined : query.sort };
  const href = (overrides) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `${categoryHref(category)}?${s}` : categoryHref(category);
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '' }, ...trail.map((c) => ({ name: c.name, path: c.slugPath }))].map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${siteConfig.url}/${c.path}`,
    })),
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\u003c') }} />

      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-stone-500">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          {trail.map((c, i) => (
            <li key={c._id} className="flex items-center gap-1.5">
              <ChevronRight size={14} strokeWidth={2} aria-hidden="true" className="text-stone-400" />
              {i === trail.length - 1 ? (
                <span aria-current="page" className="text-ink">
                  {c.name}
                </span>
              ) : (
                <Link href={categoryHref(c)} className="hover:text-ink">
                  {c.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="mt-5 max-w-3xl">
        <h1 className="headline text-4xl sm:text-5xl">{category.name}</h1>
        {category.description && <p className="mt-3 text-lg leading-relaxed text-stone-600">{category.description}</p>}
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
        <nav
          aria-label={children.length ? 'Sub-categories' : 'Related categories'}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        >
          {children.length > 0 ? (
            <FilterChip href={categoryHref(category)} active>
              All {category.name}
            </FilterChip>
          ) : (
            parent && <FilterChip href={categoryHref(parent)}>All {parent.name}</FilterChip>
          )}
          {chips.map((c) => (
            <FilterChip key={c._id} href={categoryHref(c)} active={c._id === category._id}>
              {c.name}
            </FilterChip>
          ))}
        </nav>

        <nav aria-label="Sort" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {Object.entries(PRODUCT_SORTS).map(([key, { label }]) => (
            <FilterChip key={key} href={href({ sort: key === 'newest' ? undefined : key })} active={query.sort === key}>
              {label}
            </FilterChip>
          ))}
        </nav>
      </div>

      <div className="mt-8">
        <ProductGrid products={items} preloadCount={pagination.page === 1 ? 3 : 0} />
      </div>

      <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath={categoryHref(category)} params={base} />
    </div>
  );
}
