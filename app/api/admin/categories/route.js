import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { createCategory, createCategoryGroup, getAdminCategories } from '@/lib/data/admin-categories';
import { CATEGORY_PAGE_SIZE, paginate } from '@/lib/category-tree';
import { refreshCategories } from '@/lib/revalidate';

/**
 * GET /api/admin/categories?page=1&limit=30 — categories in tree order (main, then its sub and inner categories),
 * one page at a time: { items, pagination: { page, limit, total, pages } }. Default 30 per page, at most 100.
 */
export async function GET(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const params = request.nextUrl.searchParams;
    const limit = Math.min(100, Math.max(1, Number.parseInt(params.get('limit'), 10) || CATEGORY_PAGE_SIZE));
    return json(paginate(await getAdminCategories(), params.get('page'), limit));
  } catch (err) {
    return errorResponse(err, 'GET /api/admin/categories');
  }
}

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
