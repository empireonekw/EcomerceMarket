import { siteConfig } from '@/lib/site';

/** /robots.txt — crawl the storefront, skip private areas, and find everything via the sitemap. */
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/seller', '/profile', '/messages', '/checkout', '/api/'] },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
