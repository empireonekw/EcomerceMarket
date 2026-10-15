import 'server-only';
import { unstable_cache } from 'next/cache';
import { connectDB } from '@/lib/mongodb';
import { toPlain } from '@/lib/utils';
import Category from '@/models/Category';
import Product, { PUBLIC_PRODUCT_FILTER } from '@/models/Product';

/**
 * Active categories with published product counts.
 * Cached across requests for an hour; POST /api/products calls revalidateTag('categories').
 */
export const getCategories = unstable_cache(
  async () => {
    await connectDB();
    const [categories, counts] = await Promise.all([
      Category.find({ isActive: true }).select('name slug description').sort({ sortOrder: 1, name: 1 }).lean(),
      // Covered by the { isPublished, category, createdAt } index.
      Product.aggregate([{ $match: PUBLIC_PRODUCT_FILTER }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);

    const countById = new Map(counts.map((c) => [String(c._id), c.count]));
    return toPlain(categories.map((c) => ({ ...c, productCount: countById.get(String(c._id)) ?? 0 })));
  },
  ['categories:active:v2'],
  { revalidate: 3600, tags: ['categories'] },
);
