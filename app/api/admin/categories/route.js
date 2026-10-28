import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { createCategory } from '@/lib/data/admin-categories';
import { refreshCategories } from '@/lib/revalidate';

/** POST /api/admin/categories — { name, slug?, parent?, description? } adds a category. Admin session or API key. */
export async function POST(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const category = await createCategory(await readJson(request));
    refreshCategories();
    return json(category, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/admin/categories');
  }
}
