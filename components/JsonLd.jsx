/**
 * Structured data (schema.org JSON-LD) for search engines and AI answers. `data` = one object or a list. "<" is
 * escaped so text from listings can never close the script tag.
 */
export default function JsonLd({ data }) {
  const list = (Array.isArray(data) ? data : [data]).filter(Boolean).map((d) => ({ '@context': 'https://schema.org', ...d }));
  if (!list.length) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(list.length === 1 ? list[0] : list).replace(/</g, '\\u003c') }}
    />
  );
}

/** BreadcrumbList from [{ name, href }] (href relative to the site, e.g. "/products"). */
export const breadcrumbLd = (siteUrl, crumbs) => ({
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${siteUrl}${c.href}` })),
});

/** ItemList of product links (the listings shown on a page). */
export const productListLd = (siteUrl, name, total, items, offset = 0) => ({
  '@type': 'ItemList',
  name,
  numberOfItems: total,
  itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: offset + i + 1, url: `${siteUrl}/products/${p.slug}`, name: p.title })),
});
