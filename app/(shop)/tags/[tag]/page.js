import Link from '@/components/PrefetchLink';
import BackLink from '@/components/BackLink';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import ChipScroller from '@/components/ChipScroller';
import FilterChip from '@/components/FilterChip';
import SortMenu from '@/components/SortMenu';
import Pagination from '@/components/Pagination';
import ProductGrid from '@/components/ProductGrid';
import { getPopularTags, getProducts } from '@/lib/data/products';
import { siteConfig } from '@/lib/site';
import { parseProductQuery, PRODUCT_SORTS, tagHref } from '@/lib/utils';
import { NO_PLATFORM_FEE } from '@/lib/commission';
import { TAG_INDEX_MIN } from '@/lib/data/seo';

const label = (tag) => tag.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** The live tag matching the URL (case-insensitive), with its product count; null if no live products use it. */
async function tagFor(raw) {
  const wanted = decodeURIComponent(raw).trim().toLowerCase();
  const tags = await getPopularTags({ limit: 1000, min: 1 });
  return { found: tags.find((t) => t.tag.toLowerCase() === wanted) ?? null, tags };
}

export async function generateMetadata({ params }) {
  const { found } = await tagFor((await params).tag);
  if (!found) return { title: 'Page not found', robots: { index: false } };
  const name = label(found.tag);
  const title = `${name}: ${found.count} digital ${found.count === 1 ? 'download' : 'downloads'}`;
  const description = `Browse ${found.count} ${name} templates, files and digital products from independent creators on ${siteConfig.name}. Secure checkout and instant download.`;
  return {
    title,
    description,
    // Thin tags stay out of the index (and the sitemap, lib/data/seo.js); they are still useful to shoppers.
    robots: found.count < TAG_INDEX_MIN ? { index: false, follow: true } : undefined,
    alternates: { canonical: tagHref(found.tag) },
    openGraph: { type: 'website', title, description, url: tagHref(found.tag) },
  };
}

/**
 * Programmatic landing page for every product tag (/tags/notion, /tags/wedding…): a generated intro, sorting,
 * related tags and the matching products, with ItemList + BreadcrumbList structured data for search and AI answers.
 */
export default async function TagPage({ params, searchParams }) {
  const { found, tags } = await tagFor((await params).tag);
  if (!found) notFound();
  const { tag } = found;
  const name = label(tag);

  const query = parseProductQuery(await searchParams);
  const { items, pagination } = await getProducts({ ...query, tag, category: undefined, q: undefined });

  const base = { sort: query.sort === 'newest' ? undefined : query.sort };
  const href = (overrides) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `${tagHref(tag)}?${s}` : tagHref(tag);
  };

  // Related: the most used tags that share a word with this one, topped up with the most popular overall.
  const words = tag.toLowerCase().split(/[\s_-]+/);
  const others = tags.filter((t) => t.tag !== tag && t.count >= 2);
  const related = [...others.filter((t) => words.some((w) => w.length > 2 && t.tag.toLowerCase().includes(w))), ...others]
    .filter((t, i, all) => all.indexOf(t) === i)
    .slice(0, 12);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteConfig.url}/` },
        { '@type': 'ListItem', position: 2, name: 'Products', item: `${siteConfig.url}/products` },
        { '@type': 'ListItem', position: 3, name, item: `${siteConfig.url}${tagHref(tag)}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${name} on ${siteConfig.name}`,
      numberOfItems: pagination.total,
      itemListElement: items.map((p, i) => ({
        '@type': 'ListItem',
        position: (pagination.page - 1) * pagination.limit + i + 1,
        url: `${siteConfig.url}/products/${p.slug}`,
        name: p.title,
      })),
    },
  ];

  return (
    <div className="container-page py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <div className="flex items-center gap-3">
        <BackLink fallback={'/products'} />
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <ChevronRight size={14} strokeWidth={2} aria-hidden="true" className="text-stone-400" />
              <Link href="/products" className="hover:text-ink">
                Products
              </Link>
            </li>
            <li className="flex items-center gap-2">
              <ChevronRight size={14} strokeWidth={2} aria-hidden="true" className="text-stone-400" />
              <span aria-current="page" className="text-ink">
                {name}
              </span>
            </li>
          </ol>
        </nav>
      </div>

      <header className="mt-5 max-w-3xl">
        <h1 className="headline text-4xl sm:text-5xl">{name}</h1>
        <p className="mt-3 text-lg leading-relaxed text-stone-600">
          {pagination.total} {name.toLowerCase()} {pagination.total === 1 ? 'product' : 'products'} from independent creators on {siteConfig.name}.
          Every listing is reviewed before it goes live, checkout is secure, and your files are ready to download the moment you pay
          {NO_PLATFORM_FEE ? ', with no platform fee taken from the creator’s sale.' : '.'}
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        {related.length > 0 && (
          <ChipScroller label="Related tags" className="sm:flex-1">
            {related.map((t) => (
              <FilterChip key={t.tag} href={tagHref(t.tag)}>
                {label(t.tag)}
              </FilterChip>
            ))}
          </ChipScroller>
        )}
        <SortMenu
          current={query.sort}
          options={Object.entries(PRODUCT_SORTS).map(([key, { label: sortLabel }]) => ({
            key,
            label: sortLabel,
            href: href({ sort: key === 'newest' ? undefined : key }),
          }))}
        />
      </div>

      <div className="mt-8">
        <ProductGrid products={items} preloadCount={pagination.page === 1 ? 3 : 0} />
      </div>

      <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath={tagHref(tag)} params={base} />
    </div>
  );
}
