import Link from 'next/link';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import { ALL_CATEGORIES_HREF, browsableCategories, categoryHref } from '@/lib/category-tree';
import { getCategories } from '@/lib/data/categories';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: 'All categories',
  description: `Browse every category on ${siteConfig.name}: digital downloads and handmade goods from independent creators.`,
  alternates: { canonical: ALL_CATEGORIES_HREF },
};

// Like the homepage: rebuilt at most every 5 minutes, and at once when a category changes (revalidateTag).
export const revalidate = 300;

// Same pastel order as the Shop menu and the homepage.
const TINTS = ['bg-brand-50', 'bg-tint-mint', 'bg-tint-butter', 'bg-tint-sky', 'bg-tint-blush', 'bg-tint-sage'];
const SUBS_SHOWN = 8;
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/**
 * /categories — every main category (the Shop menu shows only the best-stocked five), each with its product count,
 * description and sub-categories, in the admin's order.
 */
export default async function CategoriesPage() {
  const categories = await getCategories();
  const mains = browsableCategories(categories.filter((c) => !c.parent));
  const products = mains.reduce((sum, c) => sum + (c.totalCount ?? 0), 0);

  return (
    <div className="container-page py-12 sm:py-16">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-stone-500">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          <li className="flex items-center gap-1.5">
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
        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mains.map((c, i) => {
            const subs = categories.filter((s) => s.parent === c._id);
            return (
              <li key={c._id} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 transition-shadow hover:shadow-card">
                <Link href={categoryHref(c)} className="group flex items-start gap-3">
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-full text-gray-900 transition-colors group-hover:bg-gray-900 group-hover:text-white ${TINTS[i % TINTS.length]}`}
                  >
                    <CategoryIcon slug={c.slug} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium break-words text-ink first-letter:uppercase group-hover:underline">{c.name}</span>
                    <span className="text-sm text-stone-500">{plural(c.totalCount ?? 0, 'product')}</span>
                  </span>
                  <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-stone-400 transition-colors group-hover:text-ink" />
                </Link>
                {c.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-stone-600">{c.description}</p>}
                {subs.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${c.name} sub-categories`}>
                    {subs.slice(0, SUBS_SHOWN).map((s) => (
                      <li key={s._id}>
                        <Link
                          href={categoryHref(s)}
                          className="inline-flex rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-700 transition-colors hover:border-ink hover:text-ink"
                        >
                          {s.name}
                        </Link>
                      </li>
                    ))}
                    {subs.length > SUBS_SHOWN && (
                      <li>
                        <Link href={categoryHref(c)} className="inline-flex rounded-full px-3 py-1 text-xs font-medium text-ink hover:underline">
                          +{subs.length - SUBS_SHOWN} more
                        </Link>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
