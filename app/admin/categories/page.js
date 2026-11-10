import CategoryManager from '@/components/admin/CategoryManager';
import { MetricCard } from '@/components/admin/analytics/KpiCard';
import { PageTitle } from '@/components/admin/ui';
import { getAdminCategories } from '@/lib/data/admin-categories';

export const metadata = { title: 'Categories' };

/** Admin → Categories: add, edit, nest (main › sub › inner) and delete product categories. */
export default async function AdminCategoriesPage({ searchParams }) {
  const [categories, { page }] = await Promise.all([getAdminCategories(), searchParams]);
  // Each category's main category and level, by walking up its parents.
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const climb = (c) => {
    let node = c;
    let depth = 0;
    while (node.parent && byId.has(String(node.parent)) && depth < 10) {
      node = byId.get(String(node.parent));
      depth += 1;
    }
    return { root: String(node._id), depth };
  };
  const placed = categories.map((c) => ({ ...climb(c), count: c.count ?? 0 }));
  const level = (d) => placed.filter((p) => p.depth === d).length;
  const listingsByRoot = new Map();
  for (const p of placed) listingsByRoot.set(p.root, (listingsByRoot.get(p.root) ?? 0) + p.count);
  const empty = categories.filter((c) => !c.parent && !listingsByRoot.get(String(c._id))).length;
  return (
    <>
      <PageTitle
        title="Categories"
        description="Organise products into main categories, sub-categories and inner categories. Main categories appear in the Shop menu."
      />
      <section aria-label="Category totals" className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="All categories" value={categories.length.toLocaleString('en-US')} sub="Every level" tone="brand" />
        <MetricCard label="Main categories" value={level(0).toLocaleString('en-US')} sub="Shown in the Shop menu" />
        <MetricCard
          label="Sub-categories"
          value={level(1).toLocaleString('en-US')}
          sub={`${level(2).toLocaleString('en-US')} inner categories under them`}
        />
        <MetricCard label="Empty main categories" value={empty.toLocaleString('en-US')} sub="No listings anywhere inside" tone="ink" />
      </section>
      <CategoryManager categories={categories} initialPage={Number(page) || 1} />
    </>
  );
}
