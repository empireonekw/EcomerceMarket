import Link from '@/components/PrefetchLink';
import BackLink from '@/components/BackLink';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { CategoryColumn, CategoryDrawerButton } from '@/components/CategorySidebar';
import SortMenu from '@/components/SortMenu';
import Pagination from '@/components/Pagination';
import ProductGrid from '@/components/ProductGrid';
import { categoryHref, categoryNav } from '@/lib/category-tree';
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
 * its sub-categories: breadcrumbs on top, the category column on the left (a slide-in panel on phones), sorting and
 * pagination.
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
  const nav = categoryNav(categories, category);
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
    <div className="container-wide py-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }} />

      <div className="flex items-center gap-3">
        <BackLink fallback={parent ? categoryHref(parent) : '/categories'} />
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
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-8 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)]">
        <CategoryColumn nav={nav} />

        <div className="min-w-0">
          {/* Title, count and the controls in one compact row, so the products start high on the page. */}
          <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h1 className="font-serif text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">{category.name}</h1>
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
          {category.description && <p className="mt-3 line-clamp-2 max-w-3xl text-[15px] leading-relaxed text-stone-600">{category.description}</p>}

          <div className="mt-6">
            <ProductGrid products={items} preloadCount={pagination.page === 1 ? 4 : 0} />
          </div>

          <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath={categoryHref(category)} params={base} />
        </div>
      </div>
    </div>
  );
}
