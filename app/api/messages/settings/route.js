import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { createLabel, deleteLabel, getMessagingSettings, updateAutoReply } from '@/lib/data/messages';

/** GET /api/messages/settings — { labels, autoReply, isSeller }. */
export async function GET(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  try {
    return json(await getMessagingSettings(user.id));
  } catch (err) {
    return errorResponse(err, 'GET /api/messages/settings');
  }
}

/** PUT /api/messages/settings — { autoReply: { enabled, message } } (reply preferences). */
export async function PUT(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  try {
    const body = await readJson(request);
    return json(await updateAutoReply(user.id, body.autoReply));
  } catch (err) {
    return errorResponse(err, 'PUT /api/messages/settings');
  }
}

/** POST /api/messages/settings — { label }: creates a label. */
export async function POST(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  try {
    const body = await readJson(request);
    return json(await createLabel(user.id, body.label), 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/messages/settings');
  }
}

/** DELETE /api/messages/settings?label=… — removes a label everywhere. */
export async function DELETE(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  try {
    return json(await deleteLabel(user.id, request.nextUrl.searchParams.get('label')));
  } catch (err) {
    return errorResponse(err, 'DELETE /api/messages/settings');
  }
}
