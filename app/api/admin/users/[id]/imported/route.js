import { getRequestUser } from '@/lib/auth';
import { errorResponse, forbidden, json, readJson, unauthorized } from '@/lib/api';
import { addImportedReview, addImportedSale, deleteImportedRecord } from '@/lib/data/imported';

/**
 * A seller's sales and reviews from another platform (lib/imported.js), added by an admin after checking the proof.
 *   POST   { kind: 'sale', platform, count, note }  or  { kind: 'review', platform, authorName, rating, body, reviewedAt, note }
 *   DELETE ?kind=sale|review&entry=<id>
 * Admin session only (same-origin; not the API key).
 */
async function requireAdmin(request) {
  const admin = await getRequestUser(request);
  if (!admin) return { error: unauthorized() };
  if (admin.role !== 'admin') return { error: forbidden('Admin access required.') };
  return { admin };
}

export async function POST(request, { params }) {
  const { admin, error } = await requireAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const body = await readJson(request, 8 * 1024);
    const entry = body.kind === 'review' ? await addImportedReview(id, body, admin.id) : await addImportedSale(id, body, admin.id);
    return json(entry, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/admin/users/[id]/imported');
  }
}

export async function DELETE(request, { params }) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const search = request.nextUrl.searchParams;
    return json(await deleteImportedRecord(id, search.get('kind'), search.get('entry')));
  } catch (err) {
    return errorResponse(err, 'DELETE /api/admin/users/[id]/imported');
  }
}
