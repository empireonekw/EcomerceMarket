import Form from 'next/form';
import { notFound } from 'next/navigation';
import { MapPin, Search } from 'lucide-react';
import Link from '@/components/PrefetchLink';
import BackLink from '@/components/BackLink';
import ChipScroller from '@/components/ChipScroller';
import FilterChip from '@/components/FilterChip';
import Pagination from '@/components/Pagination';
import ProductGrid from '@/components/ProductGrid';
import SortMenu from '@/components/SortMenu';
import VerifiedBadge from '@/components/VerifiedBadge';
import { getProducts, getPublicShop } from '@/lib/data/products';
import { countryOf } from '@/lib/seller-onboarding';
import { parseProductQuery, PRODUCT_SORTS } from '@/lib/utils';

export async function generateMetadata({ params }) {
  const shop = await getPublicShop((await params).id);
  if (!shop) return { title: 'Shop not found', robots: { index: false } };
  return {
    title: `${shop.name} – Shop`,
    description: shop.description || `Digital products by ${shop.name} on Sellpify.`,
    alternates: { canonical: `/shop/${shop.id}` },
  };
}

/**
 * A shop's page (/shop/[id], linked from the seller's name on product pages): the shop's banner, logo, name and about
 * line, then all its listings, with its categories on the left, a search box and sorting. Listings only: no sales
 * figures or ratings.
 */
export default async function ShopPage({ params, searchParams }) {
  const { id } = await params;
  const shop = await getPublicShop(id);
  if (!shop) notFound();

  const query = parseProductQuery(await searchParams);
  const section = shop.categories.find((c) => c.id === query.category) ?? null;
  // The seller's featured listings are pinned first in the list (lib/data/products.js getProducts).
  const { items, pagination } = await getProducts({ ...query, category: section?.id, sellerId: shop.id });

  const base = `/shop/${shop.id}`;
  const keep = { q: query.q, category: section?.id, sort: query.sort === 'newest' ? undefined : query.sort };
  const href = (overrides) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, ...overrides })) if (v) qs.set(k, v);
    return qs.size ? `${base}?${qs}` : base;
  };
  const sections = [{ id: undefined, name: 'All', count: shop.total }, ...shop.categories];
  const country = shop.country && countryOf(shop.country)?.name;

  return (
    <div className="container-wide py-6 sm:py-10">
      <BackLink fallback="/products" />

      {/* ---------- Shop header ---------- */}
      {shop.banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shop.banner} alt="" className="mt-5 aspect-[5/1] w-full rounded-2xl object-cover" />
      )}
      <header className="mt-6 flex items-center gap-4 sm:gap-5">
        {shop.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logo} alt="" className="size-20 shrink-0 rounded-2xl object-cover ring-1 ring-black/5 sm:size-24" />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-20 shrink-0 place-items-center rounded-2xl bg-brand-100 font-serif text-4xl text-brand-800 sm:size-24"
          >
            {shop.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-serif text-3xl leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            <span className="truncate">{shop.name}</span>
            {shop.verified && <VerifiedBadge size={24} />}
          </h1>
          {country && (
            <p className="mt-1 flex items-center gap-1 text-sm text-stone-500">
              <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
              {country}
            </p>
          )}
          {shop.description && <p className="mt-2 line-clamp-2 max-w-3xl text-[15px] leading-relaxed text-stone-600">{shop.description}</p>}
        </div>
      </header>

      {/* ---------- Listings: sections on the left, search, sort and the grid ---------- */}
      <div className="mt-10 grid grid-cols-1 gap-x-8 border-t border-stone-200 pt-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Shop sections" className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5 border-r border-stone-200 pr-6">
            {sections.map((s) => {
              const active = (s.id ?? null) === (section?.id ?? null);
              return (
                <li key={s.id ?? 'all'}>
                  <Link
                    href={href({ category: s.id, page: undefined })}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors ${
                      active ? 'bg-stone-100 font-semibold text-ink' : 'text-stone-700 hover:bg-stone-50 hover:text-ink'
                    }`}
                  >
                    <span className="min-w-0 break-words">{s.name}</span>
                    <span className="shrink-0 text-sm text-stone-500 tabular-nums">{s.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-2xl font-semibold tracking-[-0.01em] text-ink">{section ? section.name : 'All items'}</h2>
            <Form action={base} className="relative w-full sm:w-72">
              {section && <input type="hidden" name="category" value={section.id} />}
              {keep.sort && <input type="hidden" name="sort" value={keep.sort} />}
              <label htmlFor="shop-search" className="sr-only">
                Search this shop
              </label>
              <input
                id="shop-search"
                name="q"
                type="search"
                defaultValue={query.q}
                placeholder={`Search all ${shop.total} items`}
                className="h-11 w-full rounded-full border border-stone-200 bg-stone-50 pr-11 pl-4 text-sm transition-colors hover:border-stone-300 focus:border-ink focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Search"
                className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink hover:bg-stone-200"
              >
                <Search size={17} strokeWidth={2} aria-hidden="true" />
              </button>
            </Form>
            <SortMenu
              current={query.sort}
              options={Object.entries(PRODUCT_SORTS).map(([key, { label }]) => ({
                key,
                label,
                href: href({ sort: key === 'newest' ? undefined : key, page: undefined }),
              }))}
            />
          </div>

          {/* Phones and tablets: the sections as a row of pills. */}
          {shop.categories.length > 0 && (
            <ChipScroller label="Shop sections" className="mt-4 lg:hidden">
              {sections.map((s) => (
                <FilterChip key={s.id ?? 'all'} href={href({ category: s.id, page: undefined })} active={(s.id ?? null) === (section?.id ?? null)}>
                  {s.name} ({s.count})
                </FilterChip>
              ))}
            </ChipScroller>
          )}

          {query.q && (
            <p className="mt-3 text-sm text-stone-500">
              {pagination.total} result{pagination.total === 1 ? '' : 's'} for “{query.q}” ·{' '}
              <Link href={href({ q: undefined, page: undefined })} className="font-medium text-ink underline underline-offset-2">
                clear
              </Link>
            </p>
          )}

          <div className="mt-6">
            <ProductGrid
              products={items}
              showShop={false}
              preloadCount={pagination.page === 1 ? 4 : 0}
              emptyMessage={query.q ? 'Nothing in this shop matches your search.' : 'This shop has no listings yet.'}
              emptyHint={query.q ? 'Try another word, or clear the search.' : 'Check back soon.'}
            />
          </div>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath={base} params={keep} />
        </div>
      </div>
    </div>
  );
}
