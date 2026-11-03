import 'server-only';
import { randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { InputError } from '@/lib/data/product-writes';
import { LOCAL_MEDIA_PREFIX } from '@/lib/image-hosts';
import { extensionOf, formatBytes, isUploadedSource, PRODUCT_UPLOAD_MAX_BYTES, UPLOAD_RULES } from '@/lib/listing';

// Seller and admin uploads (listing photos, videos and the files buyers receive).
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
const FOLDER = { photo: 'media', video: 'media', source: 'private', idDocument: 'private' };

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
// so a renamed .exe can't pass as a PDF, an e-book or a picture.
const HEAD_BYTES = 96; // enough for MOBI's marker at byte 60
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const startsWith = (bytes, sig, at = 0) => sig.every((b, i) => bytes[at + i] === b);
const isZip = (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]);
const SIGNATURES = {
  pdf: (b) => startsWith(b, ascii('%PDF')),
  zip: isZip,
  epub: isZip, // EPUB and iBooks are ZIP containers
  ibook: isZip,
  ibooks: isZip,
  mobi: (b) => startsWith(b, ascii('BOOKMOBI'), 60) || startsWith(b, ascii('TEXtREAd'), 60),
  doc: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  rtf: (b) => startsWith(b, ascii('{\\rtf')),
  // Plain text has no signature: accept it when the start has no NUL bytes (binary files nearly always do).
  txt: (b) => !b.includes(0),
  png: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]),
  jpg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  gif: (b) => startsWith(b, ascii('GIF8')),
  bmp: (b) => startsWith(b, ascii('BM')),
  psp: (b) => startsWith(b, ascii('Paint Shop Pro Image File')),
  webp: (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8),
  mp3: (b) => startsWith(b, ascii('ID3')) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  mpeg: (b) => startsWith(b, [0x00, 0x00, 0x01, 0xba]) || startsWith(b, [0x00, 0x00, 0x01, 0xb3]),
  mp4: (b) => startsWith(b, ascii('ftyp'), 4),
  mov: (b) => ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].some((box) => startsWith(b, ascii(box), 4)),
  webm: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
  // STL: text ("solid …"), or binary: an 80-byte header, a triangle count, then exactly 50 bytes per triangle.
  stl: (b, size) => startsWith(b, ascii('solid')) || (b.length >= 84 && size === 84 + 50 * b.readUInt32LE(80)),
};
SIGNATURES.jpeg = SIGNATURES.jpg;

/** Whether a file's first bytes (and, for STL, its size) match its extension. */
export const matchesSignature = (ext, bytes, size) => Boolean(SIGNATURES[ext]?.(Buffer.from(bytes), size));

/**
 * Streams a request body to disk as a `kind` upload, enforcing its size limit and file signature. `expectedSize`
 * (the request's Content-Length) must match what arrived, so a body cut short on the way is never saved as a file.
 * @returns {{ url: string, size: number, name: string }} url = public media path, or a private key for source files
 */
export async function saveLocalUpload(kind, name, body, expectedSize) {
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
      if (head.length < HEAD_BYTES) head = Buffer.concat([head, chunk]).subarray(0, HEAD_BYTES);
      done(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(body), meter, createWriteStream(target, { flags: 'wx' }));
  } catch (err) {
    await rm(target, { force: true });
    throw err instanceof InputError ? err : new InputError('The upload didn’t finish. Please try again.');
  }
  if (Number.isFinite(expectedSize) && expectedSize > 0 && size !== expectedSize) {
    await rm(target, { force: true });
    throw new InputError('The upload didn’t finish. Please try again.', {}, 400);
  }
  if (size === 0 || !matchesSignature(ext, head, size)) {
    await rm(target, { force: true });
    throw new InputError(`That file isn’t a real ${ext.toUpperCase()} file.`, {}, 415);
  }
  return { url: FOLDER[kind] === 'private' ? `uploads/private/${file}` : `${LOCAL_MEDIA_PREFIX}${file}`, size, name };
}

/** First bytes + total size of an uploaded source file, or null when it can't be found. */
async function peekSource(location) {
  if (location.startsWith('uploads/private/')) {
    const full = localPath('private', location.slice('uploads/private/'.length));
    const handle = full && (await open(/*turbopackIgnore: true*/ full, 'r').catch(() => null));
    if (!handle) return null;
    try {
      const head = Buffer.alloc(HEAD_BYTES);
      const { bytesRead } = await handle.read(head, 0, HEAD_BYTES, 0);
      return { head: head.subarray(0, bytesRead), size: (await handle.stat()).size };
    } finally {
      await handle.close();
    }
  }
  const res = await fetch(location, { headers: { Range: `bytes=0-${HEAD_BYTES - 1}` }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  const head = Buffer.from(await res.arrayBuffer()).subarray(0, HEAD_BYTES);
  const size = Number(res.headers.get('content-range')?.split('/')[1]) || Number(res.headers.get('content-length')) || undefined;
  return { head, size };
}

/**
 * Confirms an uploaded file buyers get exists and really is what its extension says (by its first bytes) before a
 * listing is saved. Errors are reported on `field` ('files' for the forms).
 * @returns {{ size?: number, format: string }}
 */
export async function inspectUploadedSource(location, field = 'files') {
  const fail = (message) => new InputError('Please fix the highlighted fields.', { [field]: message });
  if (!isUploadedSource(location)) throw fail('Upload the file here.');
  const ext = extensionOf(location);
  const file = await peekSource(location);
  if (!file) throw fail('An uploaded file can’t be found. Please upload it again.');
  if (!matchesSignature(ext, file.head, file.size)) throw fail(`A file isn’t a real ${ext.toUpperCase()}. Please upload it again.`);
  return { size: file.size, format: ext.toUpperCase() };
}

/**
 * Checks a listing's uploaded files (`files`: [{ url, name, uploadedAt }]) on the server: each exists and is a real
 * file of its type, with its true size measured here (never taken from the browser). Upload dates in the future
 * become now. Returns the cleaned list and its total size.
 */
export async function inspectUploadedFiles(files) {
  const checked = [];
  for (const f of files) {
    const { size } = await inspectUploadedSource(f.url);
    const uploadedAt = new Date(f.uploadedAt);
    checked.push({
      url: f.url,
      name: String(f.name).trim(),
      size: size ?? 0,
      uploadedAt: Number.isNaN(uploadedAt.getTime()) || uploadedAt > new Date() ? new Date() : uploadedAt,
    });
  }
  return { files: checked, totalBytes: checked.reduce((sum, f) => sum + f.size, 0) };
}

/** Size of an uploaded photo or video (this server, or Vercel Blob), or 0 for anything else (stock photo links). */
async function mediaSize(location) {
  if (location.startsWith(LOCAL_MEDIA_PREFIX)) {
    const full = localPath('media', location.slice(LOCAL_MEDIA_PREFIX.length));
    return (full && (await stat(/*turbopackIgnore: true*/ full).catch(() => null))?.size) || 0;
  }
  if (/^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(location)) {
    const res = await fetch(location, { method: 'HEAD', signal: AbortSignal.timeout(10_000) }).catch(() => null);
    return Number(res?.headers.get('content-length')) || 0;
  }
  return 0;
}

/** Total size of a listing's uploaded photos and videos (for the forms' "x MB of 100 MB used" meter). */
export async function mediaBytes(urls = []) {
  const sizes = await Promise.all([...new Set(urls.filter(Boolean))].map(mediaSize));
  return sizes.reduce((sum, n) => sum + n, 0);
}

/**
 * A product's files for the edit forms: its `files`, or — for a listing saved before multi-file uploads — its single
 * uploaded file as the first one. Each { url, name, size, uploadedAt }.
 */
export function filesForEdit(product) {
  if (product.files?.length) return product.files;
  if (product.deliveryType === 'external' || !isUploadedSource(product.downloadUrl)) return [];
  const name = product.sourceFileName || product.downloadUrl.split('/').pop();
  return [{ url: product.downloadUrl, name, size: product.fileSize ?? 0, uploadedAt: product.updatedAt ?? product.createdAt }];
}

/**
 * Everything uploaded for one listing must fit PRODUCT_UPLOAD_MAX_BYTES: its photos and videos (measured here) plus
 * `filesBytes`. Throws an InputError on `files` when it doesn't.
 */
export async function assertProductUploadBudget({ images = [], videos = [], filesBytes = 0 }) {
  const media = await Promise.all([...new Set([...images, ...videos].filter(Boolean))].map(mediaSize));
  const total = filesBytes + media.reduce((sum, n) => sum + n, 0);
  if (total > PRODUCT_UPLOAD_MAX_BYTES) {
    throw new InputError('Please fix the highlighted fields.', {
      files: `Photos, videos and files add up to ${formatBytes(total)}. The limit for one listing is ${formatBytes(PRODUCT_UPLOAD_MAX_BYTES)}: remove something or upload smaller files.`,
    });
  }
  return total;
}

/**
 * Server-side checks for a listing's uploads before it's saved (seller and admin forms):
 *  - every file in `files` exists, is a real file of its type and gets its size measured here;
 *  - photos + videos + files fit PRODUCT_UPLOAD_MAX_BYTES. That limit is enforced when the save brings an upload the
 *    listing didn't have (`previous` = its saved upload URLs), so listings made under the older limits stay editable.
 * @returns {{ files: Array, format: string | null }} format e.g. "PDF + ZIP", for the product page
 */
export async function checkListingUploads({ files = [], images = [], videos = [], previous = [] }) {
  const checked = await inspectUploadedFiles(files);
  const before = new Set(previous);
  if ([...files.map((f) => f.url), ...images, ...videos].some((url) => url && !before.has(url))) {
    await assertProductUploadBudget({ images, videos, filesBytes: checked.totalBytes });
  }
  const formats = [...new Set(checked.files.map((f) => extensionOf(f.url).toUpperCase()))];
  return { files: checked.files, format: formats.length ? formats.join(' + ').slice(0, 40) : null };
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

/**
 * Deletes uploaded files that belong to a removed product: local media (/api/files/media/…), local source files
 * (uploads/private/…) and Vercel Blob URLs. Anything else (external links, stock photos) is ignored. Never throws —
 * a file that can't be removed is only logged.
 */
export async function deleteStoredUploads(locations) {
  const blobs = [];
  for (const location of new Set(locations.filter(Boolean))) {
    try {
      if (location.startsWith(LOCAL_MEDIA_PREFIX) || location.startsWith('uploads/private/')) {
        const [folder, file] = location.startsWith(LOCAL_MEDIA_PREFIX)
          ? ['media', location.slice(LOCAL_MEDIA_PREFIX.length)]
          : ['private', location.slice('uploads/private/'.length)];
        const full = localPath(folder, file);
        if (full) await rm(/*turbopackIgnore: true*/ full, { force: true });
      } else if (/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(location)) {
        blobs.push(location);
      }
    } catch (err) {
      console.error('[uploads] could not delete', location, err);
    }
  }
  if (blobs.length && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { del } = await import('@vercel/blob');
      await del(blobs);
    } catch (err) {
      console.error('[uploads] could not delete blobs', err);
    }
  }
}
