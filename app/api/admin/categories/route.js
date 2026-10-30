import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { createCategory, createCategoryGroup } from '@/lib/data/admin-categories';
import { refreshCategories } from '@/lib/revalidate';

/**
 * POST /api/admin/categories — adds a category. Admin session or API key. Either
 *  - { main, subs: [{ name, inners: [name] }], description?, … }: a main category with at least one sub category
 *    (and optional inner categories), as typed names; existing ones are reused (lib/data/admin-categories.js), or
 *  - { name, slug?, parent?, description?, … }: one category under an existing parent id.
 */
export async function POST(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const body = await readJson(request);
    const category = 'main' in body ? await createCategoryGroup(body) : await createCategory(body);
    refreshCategories();
    return json(category, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/admin/categories');
  }
}
