import Link from '@/components/PrefetchLink';
import JsonLd, { breadcrumbLd } from '@/components/JsonLd';
import { getSeoCatalog } from '@/lib/data/seo';
import { siteConfig } from '@/lib/site';
import { tagHref } from '@/lib/utils';

export const revalidate = 3600;

export const metadata = {
  title: 'Site map',
  description: `Every part of ${siteConfig.name} in one place: categories, collections, shops and popular tags.`,
  alternates: { canonical: '/sitemap' },
};

const MAIN_PAGES = [
  ['Home', '/'],
  ['All products', '/products'],
  ['Categories', '/categories'],
  ['Collections', '/collections'],
  ['Sell on Sellpify', '/sell-on-sellpify'],
  ['How it works', '/how-it-works'],
  ['About', '/about'],
  ['Help & FAQ', '/help'],
  ['Contact', '/contact'],
  ['Terms', '/terms'],
  ['Privacy', '/privacy'],
];

function LinkList({ items, columns = 'sm:grid-cols-2 lg:grid-cols-3' }) {
  return (
    <ul className={`mt-4 grid gap-x-6 gap-y-2 ${columns}`}>
      {items.map(([label, href, note]) => (
        <li key={href} className="min-w-0">
          <Link href={href} className="text-stone-700 hover:text-ink hover:underline">
            {label}
          </Link>
          {note != null && <span className="ml-1.5 text-sm text-stone-400 tabular-nums">({note})</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * /sitemap: the human-readable site map (the XML one for search engines is /sitemap.xml). Lists the main pages, every
 * category that has listings (main › sub › inner), the collections, every shop and the popular tags, so each is at
 * most two clicks from here.
 */
export default async function SitemapPage() {
  const { categories, collections, shops, tags } = await getSeoCatalog();
  const mains = categories.filter((c) => c.depth === 0).sort((a, b) => a.name.localeCompare(b.name));
  const childrenOf = (id) => categories.filter((c) => c.parent === id).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="container-page py-12 sm:py-16">
      <JsonLd
        data={breadcrumbLd(siteConfig.url, [
          { name: 'Home', href: '/' },
          { name: 'Site map', href: '/sitemap' },
        ])}
      />
      <h1 className="headline text-4xl sm:text-5xl">Site map</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-stone-600">Everything on {siteConfig.name}, in one place.</p>

      <div className="mt-10 space-y-12">
        <section aria-labelledby="sm-main">
          <h2 id="sm-main" className="headline text-2xl">
            Pages
          </h2>
          <LinkList items={MAIN_PAGES} />
        </section>

        <section aria-labelledby="sm-categories">
          <h2 id="sm-categories" className="headline text-2xl">
            Categories
          </h2>
          <div className="mt-4 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {mains.map((m) => (
              <div key={m.id}>
                <Link href={m.href} className="font-semibold text-ink hover:underline">
                  {m.name}
                </Link>
                <span className="ml-1.5 text-sm text-stone-400 tabular-nums">({m.total})</span>
                <ul className="mt-2 space-y-1.5 border-l border-stone-200 pl-3 text-sm">
                  {childrenOf(m.id).map((sub) => (
                    <li key={sub.id}>
                      <Link href={sub.href} className="text-stone-700 hover:text-ink hover:underline">
                        {sub.name}
                      </Link>
                      {childrenOf(sub.id).length > 0 && (
                        <ul className="mt-1 space-y-1 pl-3">
                          {childrenOf(sub.id).map((inner) => (
                            <li key={inner.id}>
                              <Link href={inner.href} className="text-stone-500 hover:text-ink hover:underline">
                                {inner.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {collections.length > 0 && (
          <section aria-labelledby="sm-collections">
            <h2 id="sm-collections" className="headline text-2xl">
              Collections
            </h2>
            <LinkList items={collections.map((c) => [c.name, `/collections/${c.slug}`, c.count])} />
          </section>
        )}

        {shops.length > 0 && (
          <section aria-labelledby="sm-shops">
            <h2 id="sm-shops" className="headline text-2xl">
              Shops
            </h2>
            <LinkList
              items={[...shops].sort((a, b) => a.name.localeCompare(b.name)).map((s) => [s.name, `/shop/${s.id}`])}
              columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            />
          </section>
        )}

        {tags.length > 0 && (
          <section aria-labelledby="sm-tags">
            <h2 id="sm-tags" className="headline text-2xl">
              Popular tags
            </h2>
            <LinkList items={tags.slice(0, 120).map((t) => [t.tag, tagHref(t.tag), t.count])} columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
          </section>
        )}
      </div>
    </div>
  );
}
