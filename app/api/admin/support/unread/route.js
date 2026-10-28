import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, errorResponse } from '@/lib/api';
import { countSupportUnread } from '@/lib/data/messages';

/** GET /api/admin/support/unread — { count } for the admin sidebar badge. */
export async function GET(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    return json({ count: await countSupportUnread() });
  } catch (err) {
    return errorResponse(err, 'GET /api/admin/support/unread');
  }
}
