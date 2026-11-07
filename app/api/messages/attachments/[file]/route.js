import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { getRequestUser } from '@/lib/auth';
import { canViewAttachment } from '@/lib/data/messages';
import { UPLOAD_RULES, extensionOf } from '@/lib/listing';
import { localPath } from '@/lib/uploads';

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

/**
 * GET /api/messages/attachments/:file — an image sent in a chat, only for the people in that chat (and admins for
 * support chats). Never cached by shared caches; the browser keeps it privately.
 */
export async function GET(request, { params }) {
  const user = await getRequestUser(request);
  const { file } = await params;
  const location = `uploads/messages/${file}`;
  if (!user || !(await canViewAttachment(user, location))) return notFound();
  const full = localPath('messages', file);
  const info = full && (await stat(/*turbopackIgnore: true*/ full).catch(() => null));
  if (!info) return notFound();
  return new Response(Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ full)), {
    headers: {
      'Content-Type': UPLOAD_RULES.messageImage.types[extensionOf(file)] ?? 'application/octet-stream',
      'Content-Length': String(info.size),
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
}
