import { getSeoCatalog } from '@/lib/data/seo';
import { sitemapFiles, sitemapIndex } from '@/lib/sitemap-xml';

export const dynamic = 'force-dynamic'; // the catalog itself is cached for an hour (lib/data/seo.js)

/** GET /sitemap.xml: the main sitemap index, listing every section sitemap (lib/sitemap-xml.js). */
export async function GET() {
  try {
    const files = sitemapFiles(await getSeoCatalog());
    return new Response(sitemapIndex(files), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('[sitemap.xml]', err);
    // Never an error page for crawlers: at least the main pages.
    return new Response(sitemapIndex([{ name: 'pages.xml' }]), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
  }
}
