// Category hierarchy helpers shared by the storefront, the admin Categories screen and the server rules.
// Categories reference their parent (`parent`: id or null); at most 3 levels: main › sub › inner.

export const MAX_CATEGORY_LEVELS = 3;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const idOf = (v) => (v == null ? null : String(v));
export const byDisplayOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);

/**
 * Flattens categories into tree order (each parent followed by its children), adding
 * `depth` (0 = main), `path` ("Templates › Notion") and `ancestors` (ids, nearest last).
 * Siblings are ordered by `compare`. A category whose parent is missing is shown as a main category.
 */
export function orderTree(categories, compare = byDisplayOrder) {
  const ids = new Set(categories.map((c) => idOf(c._id)));
  const children = new Map();
  for (const c of categories) {
    const parent = ids.has(idOf(c.parent)) ? idOf(c.parent) : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(c);
  }
  const out = [];
  const visit = (parentId, depth, ancestors, names) => {
    for (const c of (children.get(parentId) ?? []).sort(compare)) {
      const id = idOf(c._id);
      if (ancestors.includes(id)) continue; // guards against a corrupted cycle
      out.push({ ...c, depth, ancestors, path: [...names, c.name].join(' › ') });
      visit(id, depth + 1, [...ancestors, id], [...names, c.name]);
    }
  };
  visit(null, 0, [], []);
  return out;
}

/** Ids of every category below `id` (children, grandchildren…). */
export function descendantIds(id, categories) {
  const target = idOf(id);
  return new Set(categories.filter((c) => (c.ancestors ?? []).map(idOf).includes(target)).map((c) => idOf(c._id)));
}

/** Levels below a category including itself: 1 for a leaf, 2 if it has children, 3 if grandchildren. */
export function subtreeLevels(id, ordered) {
  const self = ordered.find((c) => idOf(c._id) === idOf(id));
  if (!self) return 1;
  const below = ordered.filter((c) => (c.ancestors ?? []).map(idOf).includes(idOf(id)));
  return 1 + Math.max(0, ...below.map((c) => c.depth - self.depth));
}

/** "Notion Templates" → "notion-templates" (same rule as product slugs). */
export const categorySlug = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
