import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { deleteCategories, updateCategory } from '@/lib/data/admin-categories';
import { refreshCategories } from '@/lib/revalidate';

/** PATCH /api/admin/categories/:id — { name, slug, parent, description } edits (or moves) a category. */
export async function PATCH(request, { params }) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const { id } = await params;
    const category = await updateCategory(id, await readJson(request));
    refreshCategories();
    return json(category);
  } catch (err) {
    return errorResponse(err, 'PATCH /api/admin/categories/[id]');
  }
}

/** DELETE /api/admin/categories/:id — sub-categories and products move up to its parent (lib/data/admin-categories.js). */
export async function DELETE(request, { params }) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const { id } = await params;
    const result = await deleteCategories([id]);
    if (result.deleted.length) refreshCategories();
    if (result.skipped.length) return json({ error: result.skipped[0].reason }, 409);
    return json(result.deleted[0]);
  } catch (err) {
    return errorResponse(err, 'DELETE /api/admin/categories/[id]');
  }
}
