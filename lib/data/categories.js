import 'server-only';
import { unstable_cache } from 'next/cache';
import { connectDB } from '@/lib/mongodb';
import { orderTree } from '@/lib/category-tree';
import { toPlain } from '@/lib/utils';
import Category from '@/models/Category';
import Product, { PUBLIC_PRODUCT_FILTER } from '@/models/Product';

/**
 * Active categories in tree order (main categories, each followed by its sub-categories), with
 * `parent`, `depth`, `path` ("Templates › Notion"), `slugPath` (its URL: /main/sub/inner), `ancestors`, `type`, SEO fields,
 * `productCount` (published products directly in it)
 * and `totalCount` (including every sub-category). Menus show the main ones (`!parent`); pickers show all by path.
 * Cached across requests for an hour; product and category writes call revalidateTag('categories').
 */
export const getCategories = unstable_cache(
  async () => {
    await connectDB();
    const [categories, counts] = await Promise.all([
      Category.find({ isActive: true }).select('name slug description parent sortOrder type metaTitle metaDescription').lean(),
      // Covered by the { isPublished, category, createdAt } index.
      Product.aggregate([{ $match: PUBLIC_PRODUCT_FILTER }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);

    const countById = new Map(counts.map((c) => [String(c._id), c.count]));
    const tree = orderTree(toPlain(categories)).map((c) => ({ ...c, productCount: countById.get(c._id) ?? 0 }));
    return tree.map((c) => ({
      ...c,
      totalCount: tree.filter((d) => d._id === c._id || d.ancestors.includes(c._id)).reduce((sum, d) => sum + d.productCount, 0),
    }));
  },
  ['categories:active:v4'],
  { revalidate: 3600, tags: ['categories'] },
);
