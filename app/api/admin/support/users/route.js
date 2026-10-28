import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, errorResponse } from '@/lib/api';
import { searchUsers } from '@/lib/data/support';

/** GET /api/admin/support/users?q= — users to start a chat with (name, email or shop). */
export async function GET(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    return json({ users: await searchUsers(request.nextUrl.searchParams.get('q')) });
  } catch (err) {
    return errorResponse(err, 'GET /api/admin/support/users');
  }
}
