import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { getSupportThread, replyAsTeam, setSupportStatus } from '@/lib/data/support';

/** GET /api/admin/support/:id?before=<messageId> — a chat (marks it read for the team). */
export async function GET(request, { params }) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const { id } = await params;
    return json(await getSupportThread(id, { before: request.nextUrl.searchParams.get('before') }));
  } catch (err) {
    return errorResponse(err, 'GET /api/admin/support/:id');
  }
}

/** POST /api/admin/support/:id — { body }: reply as the Sellpify team. */
export async function POST(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (!auth) return unauthorized('Admin access required.');
  try {
    const { id } = await params;
    const { body } = await readJson(request);
    return json(await replyAsTeam(auth.admin?.id, id, body), 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/admin/support/:id');
  }
}

/** PATCH /api/admin/support/:id — { status: 'open' | 'resolved' }. */
export async function PATCH(request, { params }) {
  if (!(await authorizeAdminRequest(request))) return unauthorized('Admin access required.');
  try {
    const { id } = await params;
    const { status } = await readJson(request);
    return json(await setSupportStatus(id, status));
  } catch (err) {
    return errorResponse(err, 'PATCH /api/admin/support/:id');
  }
}
