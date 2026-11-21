import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import Link from '@/components/PrefetchLink';
import BackLink from '@/components/BackLink';
import ChipScroller from '@/components/ChipScroller';
import FilterChip from '@/components/FilterChip';
import JsonLd, { breadcrumbLd, productListLd } from '@/components/JsonLd';
import Pagination from '@/components/Pagination';
import ProductGrid from '@/components/ProductGrid';
import SortMenu from '@/components/SortMenu';
import { getProducts } from '@/lib/data/products';
import { collectionWhere, getCollection, getCollectionFacts, getSeoCatalog, modifierOf } from '@/lib/data/seo';
import { NO_PLATFORM_FEE } from '@/lib/commission';
import { siteConfig } from '@/lib/site';
import { formatPrice, parseProductQuery, PRODUCT_SORTS, tagHref } from '@/lib/utils';

// Re-rendered at most every hour: the counts and prices on the page come from live listings.
export const revalidate = 3600;

const usd = (cents) => (cents === 0 ? 'free' : formatPrice(cents, 'USD'));
const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

async function load(slug) {
  const collection = await getCollection(slug);
  return collection ? { collection } : null;
}

export async function generateMetadata({ params, searchParams }) {
  const found = await load((await params).slug);
  if (!found) return { title: 'Page not found', robots: { index: false } };
  const { collection } = found;
  const sp = await searchParams;
  const facts = await getCollectionFacts(collection.slug);
  const title = `${collection.name} (${facts.count})`;
  const description = `${facts.count} ${collection.name.charAt(0).toLowerCase() + collection.name.slice(1)} from ${collection.shops} independent ${collection.shops === 1 ? 'shop' : 'shops'}${
    facts.maxPrice > 0 ? `, ${facts.minPrice === 0 ? 'from free' : `from ${usd(facts.minPrice)}`} to ${usd(facts.maxPrice)}` : ''
  }. Instant download after secure checkout on ${siteConfig.name}.`;
  const page = Number(sp.page) > 1 ? Number(sp.page) : 1;
  const canonical = `/collections/${collection.slug}${page > 1 ? `?page=${page}` : ''}`;
  return {
    title,
    description,
    // Sorted views repeat the same listings: keep them out of the index, but let crawlers follow their links.
    robots: sp.sort ? { index: false, follow: true } : undefined,
    alternates: { canonical },
    openGraph: { type: 'website', title, description, url: canonical },
  };
}

/**
 * A programmatic landing page (/collections/free-calendars-and-planners…): one category (or the whole store) narrowed
 * by one attribute (free, under $5, commercial use, Canva, printable, spreadsheet). Its copy is built from the live
 * listings' real numbers (count, price range, formats, shops, tags), with its FAQ, related collections and structured
 * data. Only collections that pass the quality gates exist (lib/data/seo.js).
 */
export default async function CollectionPage({ params, searchParams }) {
  const found = await load((await params).slug);
  if (!found) notFound();
  const { collection } = found;
  const modifier = modifierOf(collection.modifier);

  const query = parseProductQuery(await searchParams);
  const [{ items, pagination }, facts, catalog] = await Promise.all([
    getProducts({ page: query.page, sort: query.sort, category: collection.categoryId ?? undefined, where: collectionWhere(collection) }),
    getCollectionFacts(collection.slug),
    getSeoCatalog(),
  ]);
  const name = collection.name;
  // Names already read as a phrase ("Editable Canva Wedding templates"): used as they are, never lowercased.
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  const base = { sort: query.sort === 'newest' ? undefined : query.sort };
  const href = (overrides) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `/collections/${collection.slug}?${s}` : `/collections/${collection.slug}`;
  };

  // Related: other angles on the same category, then the same angle in neighbouring categories.
  const sameScope = catalog.collections.filter((c) => c.slug !== collection.slug && c.categoryId === collection.categoryId);
  const sameModifier = catalog.collections.filter(
    (c) => c.slug !== collection.slug && c.modifier === collection.modifier && c.categoryId !== collection.categoryId,
  );
  const related = [...sameScope, ...sameModifier].slice(0, 10);

  const formats = facts.formats.map((f) => f.format);
  const priceLine =
    facts.maxPrice === 0
      ? `Every one of them is free to download.`
      : `Prices run from ${facts.minPrice === 0 ? 'free' : usd(facts.minPrice)} to ${usd(facts.maxPrice)}, ${facts.avgPrice ? `about ${usd(facts.avgPrice)} on average` : ''}${
          facts.free ? `, and ${facts.free} ${facts.free === 1 ? 'is' : 'are'} free` : ''
        }.`;
  const faq = [
    {
      q: `How many ${lower} are on ${siteConfig.name}?`,
      a: `${facts.count} right now, from ${collection.shops} independent ${collection.shops === 1 ? 'shop' : 'shops'}. New listings are added as creators publish them.`,
    },
    {
      q: `How much do ${lower} cost?`,
      a: facts.maxPrice === 0 ? 'They are all free: add one to your cart and check out to get the download link.' : priceLine,
    },
    ...(formats.length
      ? [{ q: `What file formats do they come in?`, a: `Mostly ${list(formats)}. Each listing shows its exact format and file size before you buy.` }]
      : []),
    {
      q: `Can I use them in commercial work?`,
      a: facts.commercial
        ? `${facts.commercial === facts.count ? 'All of them are' : `${facts.commercial} of them are`} licensed for personal and commercial use. Check the licence on each listing.`
        : 'These listings are licensed for personal use. The licence is shown on every listing page.',
    },
    {
      q: 'How do I get the files?',
      a: 'Right after checkout: the download link appears on your receipt and in your account, and it is emailed to you too.',
    },
  ];

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Collections', href: '/collections' },
    ...(collection.categoryHref ? [{ name: collection.categoryName, href: collection.categoryHref }] : []),
    { name, href: `/collections/${collection.slug}` },
  ];

  return (
    <div className="container-page py-12 sm:py-16">
      <JsonLd
        data={[
          breadcrumbLd(siteConfig.url, crumbs),
          {
            '@type': 'CollectionPage',
            name,
            url: `${siteConfig.url}/collections/${collection.slug}`,
            isPartOf: { '@type': 'WebSite', name: siteConfig.name, url: siteConfig.url },
          },
          productListLd(siteConfig.url, name, pagination.total, items, (pagination.page - 1) * pagination.limit),
          { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        ]}
      />

      <div className="flex items-center gap-3">
        <BackLink fallback="/collections" />
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
            {crumbs.map((c, i) => (
              <li key={c.href} className="flex items-center gap-2">
                {i > 0 && <ChevronRight size={14} strokeWidth={2} aria-hidden="true" className="text-stone-400" />}
                {i === crumbs.length - 1 ? (
                  <span aria-current="page" className="text-ink">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.href} className="hover:text-ink">
                    {c.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <header className="mt-5 max-w-3xl">
        <h1 className="headline text-4xl sm:text-5xl">{name}</h1>
        <p className="mt-3 text-lg leading-relaxed text-stone-600">
          {/* Category collections already say it in their name ("…templates"); store-wide ones spell it out. */}
          {facts.count} {lower} from {collection.shops} independent {collection.shops === 1 ? 'shop' : 'shops'}
          {collection.categoryId ? '' : `, all ${modifier.blurb}`}. {priceLine} {formats.length > 0 && <>Most come as {list(formats)}. </>}
          Checkout is secure and your files are ready the moment you pay{NO_PLATFORM_FEE ? ', with no platform fee taken from the creator’s sale.' : '.'}
        </p>
      </header>

      <dl className="mt-6 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 sm:grid-cols-4">
        {[
          ['Listings', facts.count.toLocaleString('en-US')],
          ['Shops', collection.shops.toLocaleString('en-US')],
          ['From', facts.minPrice === 0 ? 'Free' : usd(facts.minPrice)],
          ['Formats', formats.slice(0, 2).join(', ') || 'Various'],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-4 py-3">
            <dt className="text-xs text-stone-500">{k}</dt>
            <dd className="mt-0.5 truncate font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        {facts.tags.length > 0 && (
          <ChipScroller label="Popular tags in this collection" className="sm:flex-1">
            {facts.tags.map((t) => (
              <FilterChip key={t.tag} href={tagHref(t.tag)}>
                {t.tag}
              </FilterChip>
            ))}
          </ChipScroller>
        )}
        <SortMenu
          current={query.sort}
          options={Object.entries(PRODUCT_SORTS).map(([key, { label }]) => ({
            key,
            label,
            href: href({ sort: key === 'newest' ? undefined : key }),
          }))}
        />
      </div>

      <div className="mt-8">
        <ProductGrid products={items} preloadCount={pagination.page === 1 ? 3 : 0} />
      </div>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath={`/collections/${collection.slug}`} params={base} />

      <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="headline text-2xl">
            Questions about {lower}
          </h2>
          <dl className="mt-5 divide-y divide-stone-200 border-y border-stone-200">
            {faq.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="font-medium text-ink">{f.q}</dt>
                <dd className="mt-1.5 leading-relaxed text-stone-600">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <aside className="space-y-8">
          {facts.shops.length > 0 && (
            <section aria-labelledby="shops-heading">
              <h2 id="shops-heading" className="headline text-2xl">
                Shops to know
              </h2>
              <ul className="mt-4 space-y-2">
                {facts.shops.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/shop/${s.id}`}
                      className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 hover:border-stone-300"
                    >
                      <span className="font-medium text-ink">{s.name}</span>
                      <span className="text-sm text-stone-500">
                        {s.count} {s.count === 1 ? 'listing' : 'listings'} here
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(related.length > 0 || collection.categoryHref) && (
            <section aria-labelledby="related-heading">
              <h2 id="related-heading" className="headline text-2xl">
                Keep browsing
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {collection.categoryHref && (
                  <li>
                    <FilterChip href={collection.categoryHref}>All {collection.categoryName}</FilterChip>
                  </li>
                )}
                {related.map((c) => (
                  <li key={c.slug}>
                    <FilterChip href={`/collections/${c.slug}`}>{c.name}</FilterChip>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
