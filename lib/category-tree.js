// Category hierarchy helpers shared by the storefront, the admin Categories screen and the server rules.
// Categories reference their parent (`parent`: id or null); at most 3 levels: main › sub › inner.

export const MAX_CATEGORY_LEVELS = 3;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Category pages live at /main/sub/inner (app/(shop)/[...category]), so a main category's slug must not be the
 * first segment of an existing page or API path.
 */
export const RESERVED_ROOT_SLUGS = new Set([
  'about',
  'admin',
  'api',
  'blog',
  'checkout',
  'contact',
  'help',
  'how-it-works',
  'legal',
  'forgot-password',
  'login',
  'messages',
  'privacy',
  'products',
  'profile',
  'sell',
  'seller',
  'signup',
  'terms',
  'search',
  'cart',
  'account',
  'sitemap',
  'robots',
  'favicon',
  'static',
]);

/** What can be listed in a category — shown as a badge in the seller's category search (like Etsy). */
export const CATEGORY_TYPES = [
  { value: 'digital', label: 'Digital' },
  { value: 'both', label: 'Physical or digital' },
  { value: 'physical', label: 'Physical' },
  { value: 'service', label: 'Service' },
];
export const categoryTypeLabel = (value) => CATEGORY_TYPES.find((t) => t.value === value)?.label ?? 'Digital';

/** Public URL of a category: "/main/sub/inner". */
export const categoryHref = (category) => `/${category?.slugPath ?? category?.slug ?? ''}`;

const idOf = (v) => (v == null ? null : String(v));
export const byDisplayOrder = (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);

/**
 * Flattens categories into tree order (each parent followed by its children), adding
 * `depth` (0 = main), `path` ("Templates › Notion"), `slugPath` ("templates/notion", its URL without the leading
 * slash) and `ancestors` (ids, nearest last).
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
  const visit = (parentId, depth, ancestors, names, slugs) => {
    for (const c of (children.get(parentId) ?? []).sort(compare)) {
      const id = idOf(c._id);
      if (ancestors.includes(id)) continue; // guards against a corrupted cycle
      out.push({ ...c, depth, ancestors, path: [...names, c.name].join(' › '), slugPath: [...slugs, c.slug].join('/') });
      visit(id, depth + 1, [...ancestors, id], [...names, c.name], [...slugs, c.slug]);
    }
  };
  visit(null, 0, [], [], []);
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

// ---- Search (seller category picker) -------------------------------------------------------------------------

const fold = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Score of `query` against `text` (higher = better, 0 = no match): whole phrase > word starts > letters in order. */
function matchScore(query, text) {
  const q = fold(query).trim();
  const t = fold(text);
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 80;
  const words = q.split(/\s+/).filter(Boolean);
  const tokens = t.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.every((w) => tokens.some((tok) => tok.startsWith(w)))) return 70;
  // Each word close to a word of the text ("notoin" → "notion", "templtes" → "templates"): 1 typo, 2 for long words.
  const typos = words.map((w) => Math.min(...tokens.map((tok) => editDistance(w, tok.length > w.length ? tok.slice(0, w.length) : tok))));
  if (words.every((w, k) => w.length >= 4 && typos[k] <= (w.length >= 8 ? 2 : 1))) return 60 - 5 * Math.max(...typos);
  // Typos and missing letters ("rsuem" → "résumé templates"): every letter appears, in order.
  const compact = q.replace(/\s+/g, '');
  let i = 0;
  for (const ch of t) if (ch === compact[i]) i += 1;
  if (i === compact.length) return 40 - Math.min(30, t.length - compact.length);
  // One letter off is still a match for longer queries.
  if (compact.length >= 6 && i >= compact.length - 1) return 15;
  // Swapped letters ("wedidng"): most two-letter pairs still appear in the text.
  const dice = pairSimilarity(compact, t.replace(/[^a-z0-9]+/g, ''));
  return compact.length >= 4 && dice >= 0.45 ? Math.round(dice * 30) : 0;
}

/** Letters to add, remove, change or swap with a neighbour to turn `a` into `b` (optimal string alignment distance). */
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Share of two-letter pairs two strings have in common (Dice coefficient, 0–1). */
function pairSimilarity(a, b) {
  const pairs = (s) => {
    const out = new Map();
    for (let k = 0; k < s.length - 1; k += 1) out.set(s.slice(k, k + 2), (out.get(s.slice(k, k + 2)) ?? 0) + 1);
    return out;
  };
  const pa = pairs(a);
  const pb = pairs(b);
  let common = 0;
  for (const [pair, n] of pa) common += Math.min(n, pb.get(pair) ?? 0);
  const total = Math.max(0, a.length - 1) + Math.max(0, b.length - 1);
  return total ? (2 * common) / total : 0;
}

/**
 * Categories matching a search, best first (name matches beat path matches; deeper, more specific categories win
 * ties, like Etsy). An empty query returns them all in tree order.
 */
export function searchCategories(query, categories, limit = 12) {
  if (!String(query ?? '').trim()) return categories.slice(0, limit);
  return categories
    .map((c) => {
      // The parent path only counts for real word matches ("paper" finds everything under Paper…), never typo matches.
      const pathScore = matchScore(query, c.path);
      return { c, score: Math.max(matchScore(query, c.name), pathScore >= 70 ? pathScore - 10 : 0) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.c.depth - a.c.depth || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((r) => r.c);
}

// ---- Listing rules (seller form + server) --------------------------------------------------------------------

/**
 * Why a product can't go in category `id`, or null when it can. A main category that has sub-categories only groups
 * them: the product goes in one of its subs (an inner category is optional). `categories` = the tree (orderTree);
 * an id that isn't in it is left to the server's own lookup.
 */
export function listingCategoryProblem(id, categories) {
  const category = categories.find((c) => idOf(c._id) === idOf(id));
  if (!category || category.parent) return null;
  return categories.some((c) => idOf(c.parent) === idOf(category._id)) ? 'Choose a sub category.' : null;
}
