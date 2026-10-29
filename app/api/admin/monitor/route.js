import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, errorResponse } from '@/lib/api';
import { getSystemSnapshot } from '@/lib/data/monitor';

/** GET /api/admin/monitor — live health of every part of the site (Admin → System Health). Admin session or API key. */
export async function GET(request) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    return json(await getSystemSnapshot());
  } catch (err) {
    return errorResponse(err, 'GET /api/admin/monitor');
  }
}
