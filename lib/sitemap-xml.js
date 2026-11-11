import 'server-only';
import { POLICIES } from '@/lib/policies';
import { absoluteUrl } from '@/lib/data/seo';
import { tagHref } from '@/lib/utils';

// Sitemap files (XML) built from the SEO catalog (lib/data/seo.js).
//   /sitemap.xml                       the main index: lists every sitemap below
//   /sitemaps/pages.xml                home, browse, about, help, legal…
//   /sitemaps/categories-<main>.xml    one per main category: it and all its sub- and inner categories
//   /sitemaps/products-<main>-<n>.xml  that main category's listings (with their cover image), 10,000 per file
//   /sitemaps/shops.xml                every shop with live listings
//   /sitemaps/collections.xml          the programmatic landing pages (/collections/…)
//   /sitemaps/tags.xml                 tag pages with at least TAG_INDEX_MIN listings (lib/data/seo.js)
// Google doesn't accept an index inside an index, so the main index lists them all, grouped by section.
// No <priority> or <changefreq> (Google ignores both); <lastmod> only where it's a real change date.

export const PRODUCTS_PER_FILE = 10000;

// Indexable pages only: sign-up, login and the shop wizard (/sell-on-sellpify) are noindex, so they stay out.
export const STATIC_PAGES = [
  '/',
  '/products',
  '/categories',
  '/collections',
  '/sitemap',
  '/how-it-works',
  '/about',
  '/help',
  '/contact',
  '/legal',
  '/terms',
  '/privacy',
  ...Object.keys(POLICIES).map((s) => `/legal/${s}`),
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const iso = (d) => (d ? new Date(d).toISOString() : null);
const latest = (dates) => dates.filter(Boolean).reduce((a, b) => (a && a > b ? a : b), null);

const url = ({ loc, lastmod, images = [] }) =>
  `<url><loc>${esc(absoluteUrl(loc))}</loc>${lastmod ? `<lastmod>${iso(lastmod)}</lastmod>` : ''}${images
    .map((img) => `<image:image><image:loc>${esc(absoluteUrl(img))}</image:loc></image:image>`)
    .join('')}</url>`;

export const urlset = (urls) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls
    .map(url)
    .join('\n')}\n</urlset>\n`;

export const sitemapIndex = (files) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files
    .map((f) => `<sitemap><loc>${esc(absoluteUrl(`/sitemaps/${f.name}`))}</loc>${f.lastmod ? `<lastmod>${iso(f.lastmod)}</lastmod>` : ''}</sitemap>`)
    .join('\n')}\n</sitemapindex>\n`;

/** Every sitemap file the catalog produces: [{ name, lastmod, urls: () => [...] }], in index order. */
export function sitemapFiles(catalog) {
  const files = [{ name: 'pages.xml', lastmod: null, urls: () => STATIC_PAGES.map((loc) => ({ loc })) }];

  // Categories: one file per main category, holding it and everything below it.
  const mains = catalog.categories.filter((c) => c.depth === 0).sort((a, b) => a.name.localeCompare(b.name));
  for (const main of mains) {
    const family = catalog.categories.filter((c) => c.main === main.id).sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));
    files.push({
      name: `categories-${main.mainSlug}.xml`,
      lastmod: latest(family.map((c) => c.updatedAt)),
      urls: () => family.map((c) => ({ loc: c.href, lastmod: c.updatedAt })),
    });
  }

  // Products: grouped by main category (then split every PRODUCTS_PER_FILE).
  const groups = new Map();
  for (const p of catalog.products) groups.set(p.mainSlug, [...(groups.get(p.mainSlug) ?? []), p]);
  for (const [mainSlug, products] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (let i = 0; i * PRODUCTS_PER_FILE < products.length; i += 1) {
      const chunk = products.slice(i * PRODUCTS_PER_FILE, (i + 1) * PRODUCTS_PER_FILE);
      files.push({
        name: `products-${mainSlug}-${i + 1}.xml`,
        lastmod: latest(chunk.map((p) => p.updatedAt)),
        urls: () => chunk.map((p) => ({ loc: `/products/${p.slug}`, lastmod: p.updatedAt, images: p.coverImage ? [p.coverImage] : [] })),
      });
    }
  }

  if (catalog.shops.length)
    files.push({
      name: 'shops.xml',
      lastmod: latest(catalog.shops.map((s) => s.updatedAt)),
      urls: () => catalog.shops.map((s) => ({ loc: `/shop/${s.id}`, lastmod: s.updatedAt })),
    });
  if (catalog.collections.length)
    files.push({
      name: 'collections.xml',
      lastmod: latest(catalog.collections.map((c) => c.updatedAt)),
      urls: () => catalog.collections.map((c) => ({ loc: `/collections/${c.slug}`, lastmod: c.updatedAt })),
    });
  if (catalog.tags.length)
    files.push({
      name: 'tags.xml',
      lastmod: latest(catalog.tags.map((t) => t.updatedAt)),
      urls: () => catalog.tags.map((t) => ({ loc: tagHref(t.tag), lastmod: t.updatedAt })),
    });
  return files;
}
