import { json, unauthorized } from '@/lib/api';
import { getCategories } from '@/lib/data/categories';
import { rankkwSeller } from '@/lib/rankkw-link';

/**
 * GET /api/integrations/rankkw/categories (Bearer) — the categories a listing can go in, in tree order:
 * [{ id, path, pickable }]. A main category with sub-categories isn't pickable (lib/category-tree.js).
 */
export async function GET(request) {
  if (!(await rankkwSeller(request))) return unauthorized('Not connected.');
  const categories = await getCategories();
  const hasChildren = new Set(categories.filter((c) => c.parent).map((c) => String(c.parent)));
  return json(categories.map((c) => ({ id: String(c._id), path: c.path ?? c.name, pickable: Boolean(c.parent) || !hasChildren.has(String(c._id)) })));
}
