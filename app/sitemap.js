import { categoryHref } from '@/lib/category-tree';
import { getCategories } from '@/lib/data/categories';
import { getPopularTags, getSitemapProducts } from '@/lib/data/products';
import { POLICIES } from '@/lib/policies';
import { siteConfig } from '@/lib/site';
import { tagHref } from '@/lib/utils';

// Regenerated at most hourly (not at build time only), so new categories and products show up for search engines.
export const revalidate = 3600;

/** /sitemap.xml: the home page, main pages, every category page (/main/sub/inner), tag pages and every live product. */
export default async function sitemap() {
  const url = (path) => `${siteConfig.url}${path}`;
  const pages = ['/', '/products', '/sell/signup', '/about', '/blog', '/contact', '/how-it-works', '/help', '/legal', '/terms', '/privacy', ...Object.keys(POLICIES).map((s) => `/legal/${s}`)].map((path) => ({
    url: url(path),
    changeFrequency: path === '/' || path === '/products' ? 'daily' : 'monthly',
    priority: path === '/' ? 1 : 0.6,
  }));
  try {
    const [categories, products, tags] = await Promise.all([getCategories(), getSitemapProducts(), getPopularTags()]);
    return [
      ...pages,
      ...categories.map((c) => ({ url: url(categoryHref(c)), changeFrequency: 'daily', priority: c.depth === 0 ? 0.8 : 0.7 })),
      ...tags.map((t) => ({ url: url(tagHref(t.tag)), changeFrequency: 'weekly', priority: 0.5 })),
      ...products.map((p) => ({ url: url(`/products/${p.slug}`), lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.7 })),
    ];
  } catch (err) {
    console.error('[sitemap] catalogue unavailable', err);
    return pages;
  }
}
