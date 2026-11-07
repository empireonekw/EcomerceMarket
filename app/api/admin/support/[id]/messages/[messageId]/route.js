import { authorizeAdminRequest } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { deleteTeamMessage, editTeamMessage } from '@/lib/data/support';

/** PATCH /api/admin/support/:id/messages/:messageId — { body }: edit your own reply (shown to the user as edited). */
export async function PATCH(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (!auth?.admin) return unauthorized('Admin access required.');
  try {
    const { id, messageId } = await params;
    const { body } = await readJson(request);
    return json(await editTeamMessage(auth.admin.id, id, messageId, body));
  } catch (err) {
    return errorResponse(err, 'PATCH /api/admin/support/:id/messages/:messageId');
  }
}

/** DELETE /api/admin/support/:id/messages/:messageId — delete your own reply (the user sees it was deleted). */
export async function DELETE(request, { params }) {
  const auth = await authorizeAdminRequest(request);
  if (!auth?.admin) return unauthorized('Admin access required.');
  try {
    const { id, messageId } = await params;
    return json(await deleteTeamMessage(auth.admin.id, id, messageId));
  } catch (err) {
    return errorResponse(err, 'DELETE /api/admin/support/:id/messages/:messageId');
  }
}
