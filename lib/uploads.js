import 'server-only';
import { randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { InputError } from '@/lib/data/product-writes';
import { LOCAL_MEDIA_PREFIX } from '@/lib/image-hosts';
import { extensionOf, isUploadedSource, UPLOAD_RULES } from '@/lib/listing';

// Seller uploads (listing photos, videos and the PDF/ZIP buyers receive).
//  - 'blob':  Vercel Blob (BLOB_READ_WRITE_TOKEN set). The browser uploads straight to Blob with a short-lived token
//             from /api/seller/uploads, so big files never pass through our server. Source files get an unguessable
//             random suffix and are only ever streamed to buyers through /api/downloads — their URL is never shown.
//  - 'local': this server's disk (UPLOAD_DIR, default ./uploads) — development and self-hosted servers.
//  - null:    neither is possible (on Vercel the disk is read-only), so uploads are switched off until Blob is set up.

export function uploadDriver() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  if (process.env.VERCEL) return null;
  return 'local';
}

// turbopackIgnore: a runtime folder, not something to trace into the build.
const UPLOAD_ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'uploads'));
const FOLDER = { photo: 'media', video: 'media', source: 'private' };

/** "My Planner (v2).PDF" → "<random>-my-planner-v2.pdf": unguessable, filesystem- and URL-safe. */
function storedName(name) {
  const ext = extensionOf(name);
  const base =
    String(name)
      .slice(0, -(ext.length + 1))
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'file';
  return `${randomBytes(8).toString('hex')}-${base}.${ext}`;
}

/** A file inside the uploads folder, or null for anything that could escape it. */
export function localPath(folder, file) {
  if (!['media', 'private'].includes(folder) || !/^[\w.-]+$/.test(file ?? '')) return null;
  const full = path.join(/*turbopackIgnore: true*/ UPLOAD_ROOT, folder, file);
  return full.startsWith(path.join(/*turbopackIgnore: true*/ UPLOAD_ROOT, folder) + path.sep) ? full : null;
}

// File signatures ("magic numbers"): a file is only accepted when its first bytes match its extension,
// so a renamed .exe can't pass as a PDF or ZIP.
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const startsWith = (bytes, sig, at = 0) => sig.every((b, i) => bytes[at + i] === b);
const SIGNATURES = {
  pdf: (b) => startsWith(b, ascii('%PDF')),
  zip: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]),
  png: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]),
  jpg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  gif: (b) => startsWith(b, ascii('GIF8')),
  webp: (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8),
  mp4: (b) => startsWith(b, ascii('ftyp'), 4),
  webm: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
};
SIGNATURES.jpeg = SIGNATURES.jpg;
SIGNATURES.mov = SIGNATURES.mp4;

export const matchesSignature = (ext, bytes) => Boolean(SIGNATURES[ext]?.(bytes));

/**
 * Streams a request body to disk as a `kind` upload, enforcing its size limit and file signature.
 * @returns {{ url: string, size: number, name: string }} url = public media path, or a private key for source files
 */
export async function saveLocalUpload(kind, name, body) {
  const rule = UPLOAD_RULES[kind];
  const ext = extensionOf(name);
  const file = storedName(name);
  const dir = path.join(/*turbopackIgnore: true*/ UPLOAD_ROOT, FOLDER[kind]);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, file);

  let size = 0;
  let head = Buffer.alloc(0);
  const meter = new Transform({
    transform(chunk, _encoding, done) {
      size += chunk.length;
      if (size > rule.maxBytes) return done(new InputError(`That file is too large for a ${kind}.`, {}, 413));
      if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
      done(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(body), meter, createWriteStream(target, { flags: 'wx' }));
  } catch (err) {
    await rm(target, { force: true });
    throw err instanceof InputError ? err : new InputError('The upload didn’t finish. Please try again.');
  }
  if (size === 0 || !matchesSignature(ext, head)) {
    await rm(target, { force: true });
    throw new InputError(`That file isn’t a real ${ext.toUpperCase()} file.`, {}, 415);
  }
  return { url: kind === 'source' ? `uploads/private/${file}` : `${LOCAL_MEDIA_PREFIX}${file}`, size, name };
}

/** First bytes + total size of an uploaded source file, or null when it can't be found. */
async function peekSource(location) {
  if (location.startsWith('uploads/private/')) {
    const full = localPath('private', location.slice('uploads/private/'.length));
    const handle = full && (await open(/*turbopackIgnore: true*/ full, 'r').catch(() => null));
    if (!handle) return null;
    try {
      const head = Buffer.alloc(16);
      await handle.read(head, 0, 16, 0);
      return { head, size: (await handle.stat()).size };
    } finally {
      await handle.close();
    }
  }
  const res = await fetch(location, { headers: { Range: 'bytes=0-15' }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  const head = Buffer.from(await res.arrayBuffer()).subarray(0, 16);
  const size = Number(res.headers.get('content-range')?.split('/')[1]) || Number(res.headers.get('content-length')) || undefined;
  return { head, size };
}

/**
 * Confirms an uploaded source file exists and really is a PDF/ZIP (by its first bytes) before a listing is saved.
 * @returns {{ size?: number, format: string }}
 */
export async function inspectUploadedSource(location) {
  const fail = (message) => new InputError('Please fix the highlighted fields.', { downloadUrl: message });
  if (!isUploadedSource(location)) throw fail('Upload a PDF or ZIP file.');
  const ext = extensionOf(location);
  const file = await peekSource(location);
  if (!file) throw fail('That uploaded file can’t be found — please upload it again.');
  if (!matchesSignature(ext, file.head)) throw fail(`That file isn’t a real ${ext.toUpperCase()} — please upload it again.`);
  return { size: file.size, format: ext.toUpperCase() };
}

/** Opens an uploaded source file for a buyer's download: { stream, size?, contentType } or null. */
export async function openUploadedSource(location) {
  const contentType = UPLOAD_RULES.source.types[extensionOf(location)] ?? 'application/octet-stream';
  if (location.startsWith('uploads/private/')) {
    const full = localPath('private', location.slice('uploads/private/'.length));
    const info = full && (await stat(/*turbopackIgnore: true*/ full).catch(() => null));
    if (!info) return null;
    return { stream: Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ full)), size: info.size, contentType };
  }
  // Time out waiting for the storage to answer, but never cut off a large file mid-download.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  const res = await fetch(location, { signal: controller.signal }).catch(() => null);
  clearTimeout(timer);
  if (!res?.ok || !res.body) return null;
  return { stream: res.body, size: Number(res.headers.get('content-length')) || undefined, contentType };
}
