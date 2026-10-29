import { categoryHref } from '@/lib/category-tree';
import { getCategories } from '@/lib/data/categories';
import { getSitemapProducts } from '@/lib/data/products';
import { siteConfig } from '@/lib/site';

// Regenerated at most hourly (not at build time only), so new categories and products show up for search engines.
export const revalidate = 3600;

/** /sitemap.xml — the home page, main pages, every category page (/main/sub/inner) and every live product. */
export default async function sitemap() {
  const url = (path) => `${siteConfig.url}${path}`;
  const pages = ['/', '/products', '/about', '/blog', '/contact', '/terms', '/privacy'].map((path) => ({
    url: url(path),
    changeFrequency: path === '/' || path === '/products' ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : 0.6,
  }));
  try {
    const [categories, products] = await Promise.all([getCategories(), getSitemapProducts()]);
    return [
      ...pages,
      ...categories.map((c) => ({ url: url(categoryHref(c)), changeFrequency: 'daily', priority: c.depth === 0 ? 0.8 : 0.7 })),
      ...products.map((p) => ({ url: url(`/products/${p.slug}`), lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.7 })),
    ];
  } catch (err) {
    console.error('[sitemap] catalogue unavailable', err);
    return pages;
  }
}
