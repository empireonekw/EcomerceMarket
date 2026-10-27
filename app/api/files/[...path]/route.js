import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { extensionOf, UPLOAD_RULES } from '@/lib/listing';
import { localPath } from '@/lib/uploads';

const TYPES = { ...UPLOAD_RULES.photo.types, ...UPLOAD_RULES.video.types };
const notFound = () => new Response('Not found', { status: 404 });

/**
 * GET /api/files/media/<file> — listing photos and videos stored on this server (when Vercel Blob isn't set up).
 * Only the public `media` folder is served; buyers' PDF/ZIP files are private and only go out via /api/downloads.
 * Supports Range requests so videos can seek.
 */
export async function GET(request, { params }) {
  const { path: parts } = await params;
  if (parts.length !== 2 || parts[0] !== 'media') return notFound();
  const full = localPath('media', parts[1]);
  const type = TYPES[extensionOf(parts[1])];
  const info = full && type && (await stat(full).catch(() => null));
  if (!info?.isFile()) return notFound();

  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable', // names are random and never reused
    'X-Content-Type-Options': 'nosniff',
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
    return new Response(Readable.toWeb(createReadStream(full, { start, end })), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(createReadStream(full)), { headers: { ...headers, 'Content-Length': String(info.size) } });
}
