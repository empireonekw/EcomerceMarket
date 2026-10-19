import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';

/** After a product changes: refresh the cached homepage, its product page(s) and category counts. */
export function refreshStorefront(...slugs) {
  revalidatePath('/');
  for (const slug of new Set(slugs.filter(Boolean))) revalidatePath(`/products/${slug}`);
  revalidateTag('categories', 'max');
}
