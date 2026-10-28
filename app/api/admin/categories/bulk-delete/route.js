import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { deleteCategories } from '@/lib/data/admin-categories';
import { refreshCategories } from '@/lib/revalidate';

/** POST /api/admin/categories/bulk-delete — { ids } → { deleted, skipped } (each skipped one says why). */
export async function POST(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const { ids } = await readJson(request);
    const result = await deleteCategories(ids);
    if (result.deleted.length) refreshCategories();
    return json(result);
  } catch (err) {
    return errorResponse(err, 'POST /api/admin/categories/bulk-delete');
  }
}
