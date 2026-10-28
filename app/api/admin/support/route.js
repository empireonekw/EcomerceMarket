import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { listSupportThreads, messageUser } from '@/lib/data/support';

/** GET /api/admin/support?status=open|resolved&q=&page= — support chats. Admin session or Bearer ADMIN_API_KEY. */
export async function GET(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const sp = request.nextUrl.searchParams;
    return json(await listSupportThreads({ status: sp.get('status'), q: sp.get('q'), page: sp.get('page') }));
  } catch (err) {
    return errorResponse(err, 'GET /api/admin/support');
  }
}

/** POST /api/admin/support — { userId | email, body }: message a user directly (starts or continues their chat). */
export async function POST(request) {
  const auth = await authorizeAdminRequest(request);
  if (!auth) return unauthorized('Admin access required.');
  try {
    return json(await messageUser(auth.admin?.id, await readJson(request)), 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/admin/support');
  }
}
