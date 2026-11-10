import Link from '@/components/PrefetchLink';
import JsonLd, { breadcrumbLd } from '@/components/JsonLd';
import { getSeoCatalog, MODIFIERS } from '@/lib/data/seo';
import { siteConfig } from '@/lib/site';

export const revalidate = 3600;

export const metadata = {
  title: 'Collections: free, under $5, Canva, printable and more',
  description: `Hand-picked groupings of digital products on ${siteConfig.name}: free downloads, items under $5, commercial-use files, editable Canva templates, printables and spreadsheets, by category.`,
  alternates: { canonical: '/collections' },
};

/** /collections: the hub for every programmatic collection page, grouped by what they have in common. */
export default async function CollectionsPage() {
  const { collections } = await getSeoCatalog();
  const groups = MODIFIERS.map((m) => ({ ...m, items: collections.filter((c) => c.modifier === m.key) })).filter((g) => g.items.length);

  return (
    <div className="container-page py-12 sm:py-16">
      <JsonLd
        data={[
          breadcrumbLd(siteConfig.url, [
            { name: 'Home', href: '/' },
            { name: 'Collections', href: '/collections' },
          ]),
          {
            '@type': 'CollectionPage',
            name: 'Collections',
            url: `${siteConfig.url}/collections`,
            hasPart: collections.map((c) => ({ '@type': 'CollectionPage', name: c.name, url: `${siteConfig.url}/collections/${c.slug}` })),
          },
        ]}
      />
      <header className="max-w-3xl">
        <h1 className="headline text-4xl sm:text-5xl">Collections</h1>
        <p className="mt-3 text-lg leading-relaxed text-stone-600">
          {collections.length} ways into the catalogue: free downloads, finds under $5, files you can use in client work, templates you edit in Canva,
          printables and spreadsheets, each narrowed to a category. Every collection is built from live listings and updated through the day.
        </p>
      </header>

      <div className="mt-10 space-y-12">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`g-${g.key}`}>
            <h2 id={`g-${g.key}`} className="headline text-2xl">
              {g.label}
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/collections/${c.slug}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 transition-colors hover:border-stone-300"
                  >
                    <span className="min-w-0 truncate font-medium text-ink">{c.name}</span>
                    <span className="shrink-0 text-sm text-stone-500 tabular-nums">{c.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
