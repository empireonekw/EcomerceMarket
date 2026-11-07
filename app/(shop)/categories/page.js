import Link from '@/components/PrefetchLink';
import { ChevronRight } from 'lucide-react';
import CategoryBrowser from '@/components/CategoryBrowser';
import { ALL_CATEGORIES_HREF, browsableCategories } from '@/lib/category-tree';
import { getCategories } from '@/lib/data/categories';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: 'All categories',
  description: `Browse every category on ${siteConfig.name}: digital downloads and handmade goods from independent creators.`,
  alternates: { canonical: ALL_CATEGORIES_HREF },
};

// Like the homepage: rebuilt at most every 5 minutes, and at once when a category changes (revalidateTag).
export const revalidate = 300;

// Only what the cards and the search need goes to the browser (no SEO fields or sort keys).
const slim = ({ _id, name, slug, slugPath, path, description, parent, ancestors, depth, totalCount }) => ({
  _id, name, slug, slugPath, path, description, parent, ancestors, depth, totalCount,
});
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * /categories — every main category (the Shop menu shows only the best-stocked five), each with its product count,
 * description and sub-categories, with a search box and sorting (components/CategoryBrowser.jsx).
 */
export default async function CategoriesPage() {
  const categories = await getCategories();
  const mains = browsableCategories(categories.filter((c) => !c.parent));
  const products = mains.reduce((sum, c) => sum + (c.totalCount ?? 0), 0);

  return (
    <div className="container-page py-12 sm:py-16">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          <li className="flex items-center gap-2">
            <ChevronRight size={14} strokeWidth={2} aria-hidden="true" className="text-stone-400" />
            <span aria-current="page" className="text-ink">
              All categories
            </span>
          </li>
        </ol>
      </nav>

      <header className="mt-5 max-w-3xl">
        <h1 className="headline text-4xl sm:text-5xl">All categories</h1>
        <p className="mt-3 text-stone-500">
          {plural(mains.length, 'category', 'categories')} · {plural(products, 'product')}
        </p>
      </header>

      {mains.length === 0 ? (
        <p className="mt-10 text-stone-500">No categories yet.</p>
      ) : (
        <CategoryBrowser mains={mains.map(slim)} categories={categories.map(slim)} />
      )}
    </div>
  );
}
