import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { createCategory, createCategoryFromPath } from '@/lib/data/admin-categories';
import { refreshCategories } from '@/lib/revalidate';

/**
 * POST /api/admin/categories — adds a category. Admin session or API key. Either
 *  - { main, sub?, inner?, slug?, description?, … }: typed names; missing levels above the new one are created, or
 *  - { name, slug?, parent?, description?, … }: under an existing parent id.
 */
export async function POST(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const body = await readJson(request);
    const category = 'main' in body ? await createCategoryFromPath(body) : await createCategory(body);
    refreshCategories();
    return json(category, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/admin/categories');
  }
}
