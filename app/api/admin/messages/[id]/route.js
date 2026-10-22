import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { setContactMessageStatus } from '@/lib/data/contact';

/** PATCH /api/admin/messages/:id — { status: 'new' | 'resolved' }. Admin session or Bearer ADMIN_API_KEY. */
export async function PATCH(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (!auth) return unauthorized('Admin access required.');

  try {
    const { id } = await params;
    const { status } = await readJson(request);
    return json(await setContactMessageStatus(id, status));
  } catch (err) {
    return errorResponse(err, 'PATCH /api/admin/messages/[id]');
  }
}
