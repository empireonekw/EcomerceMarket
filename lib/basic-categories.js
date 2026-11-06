import { categorySlug } from '@/lib/category-tree';

// General categories for any digital product, each with the same name on all three levels (Digital › Digital › Digital).
// A seller who can't find their category picks one in one click (components/CategorySelect.jsx). They're created the
// first time a listing form opens without them (lib/data/categories.js getFormCategories).

export const BASIC_CATEGORY_NAMES = ['Digital', 'Public'];

/** Each basic category as the main › sub › inner names to create. */
export const BASIC_CATEGORIES = BASIC_CATEGORY_NAMES.map((name) => ({ main: name, sub: name, inner: name }));

/** The basic categories that exist in `categories` (the getCategories() tree): [{ id, trail }]. */
export function findBasicCategories(categories) {
  const child = (parentId, name) => categories.find((c) => (c.parent ?? null) === parentId && c.slug === categorySlug(name));
  return BASIC_CATEGORIES.flatMap((b) => {
    const main = child(null, b.main);
    const sub = main && child(main._id, b.sub);
    const inner = sub && child(sub._id, b.inner);
    return inner ? [{ id: inner._id, trail: [main.name, sub.name, inner.name] }] : [];
  });
}
