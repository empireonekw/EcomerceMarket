import { getSeoCatalog } from '@/lib/data/seo';
import { sitemapFiles, STATIC_PAGES, urlset } from '@/lib/sitemap-xml';

export const dynamic = 'force-dynamic'; // the catalog itself is cached for an hour (lib/data/seo.js)

const XML = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' };

/** GET /sitemaps/<name>.xml: one section sitemap listed in /sitemap.xml (lib/sitemap-xml.js). */
export async function GET(_request, { params }) {
  const { file } = await params;
  try {
    const found = sitemapFiles(await getSeoCatalog()).find((f) => f.name === file);
    if (!found) return new Response('Not found', { status: 404 });
    return new Response(urlset(found.urls()), { headers: XML });
  } catch (err) {
    console.error(`[sitemaps/${file}]`, err);
    if (file === 'pages.xml') return new Response(urlset(STATIC_PAGES.map((loc) => ({ loc }))), { headers: XML });
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '600' } });
  }
}
