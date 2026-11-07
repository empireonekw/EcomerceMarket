import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, errorResponse } from '@/lib/api';
import { uploadProblem } from '@/lib/listing';
import { rateLimit } from '@/lib/rate-limit';
import { saveLocalUpload, storeServerUpload, uploadDriver } from '@/lib/uploads';

/**
 * PUT /api/messages/attachments?name=<file name> — raw image body (JPG, PNG, WebP or GIF, up to 5 MB) for a message or
 * support chat. Checked like every upload (type, size, real file signature) and kept private. Returns { url, name },
 * where `url` is the location to send with the message (POST /api/messages/:id or /api/admin/support/:id).
 */
export async function PUT(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized();
  if (!rateLimit(`msg-upload:${user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 }).ok) {
    return json({ error: 'Too many images in a short time. Please try again later.' }, 429);
  }
  const name = (request.nextUrl.searchParams.get('name') ?? '').slice(0, 200);
  const size = Number(request.headers.get('content-length'));
  const problem = uploadProblem('messageImage', { name, size: Number.isFinite(size) ? size : 1 });
  if (problem) return json({ error: problem }, 400);
  if (!request.body) return json({ error: 'The image is empty.' }, 400);
  try {
    const saved =
      uploadDriver() === 'local'
        ? await saveLocalUpload('messageImage', name, request.body, Number.isFinite(size) ? size : undefined)
        : await storeServerUpload('messageImage', name, Buffer.from(await request.arrayBuffer()));
    return json({ url: saved.url, name: saved.name }, 201);
  } catch (err) {
    return errorResponse(err, 'PUT /api/messages/attachments');
  }
}
