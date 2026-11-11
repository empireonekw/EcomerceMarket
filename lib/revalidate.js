import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';
import { pingIndexNow } from '@/lib/indexnow';

/**
 * After a product changes: refresh the cached homepage, its product page(s) and category counts, and tell IndexNow
 * search engines (Bing…) those pages changed (lib/indexnow.js).
 */
export function refreshStorefront(...slugs) {
  revalidatePath('/');
  const changed = [...new Set(slugs.filter(Boolean))];
  for (const slug of changed) revalidatePath(`/products/${slug}`);
  revalidateTag('categories', 'max');
  pingIndexNow(changed.map((slug) => `/products/${slug}`));
}

/**
 * After a category changes: menus and filters (cached list), the homepage and product pages that show its name.
 * Expired at once ({ expire: 0 }), not served stale once more ('max'): the admin and seller forms opened right after
 * must already list the new categories.
 */
export function refreshCategories() {
  revalidateTag('categories', { expire: 0 });
  revalidatePath('/');
  revalidatePath('/products/[slug]', 'page');
}
