// Browser-side seller uploads (listing form). The server picks the storage (lib/uploads.js → uploadDriver()):
//  'blob'  → straight to Vercel Blob with a token from /api/seller/uploads (large files never touch our server)
//  'local' → PUT to /api/seller/uploads/local, saved on this server
import { upload } from '@vercel/blob/client';
import { extensionOf, uploadProblem, UPLOAD_RULES } from '@/lib/listing';

const MB = 1024 * 1024;

/** "Mon Planner (v2).pdf" → "mon-planner-v2.pdf" for the storage path (the original name is kept separately). */
const safeName = (name) => {
  const ext = extensionOf(name);
  const base = name
    .slice(0, -(ext.length + 1))
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'file'}.${ext}`;
};

function putLocal(file, kind, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/seller/uploads/local?kind=${kind}&name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader('Content-Type', UPLOAD_RULES[kind].types[extensionOf(file.name)]);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || (xhr.status === 413 ? 'That file is too large.' : 'The upload failed. Please try again.')));
    };
    xhr.onerror = () => reject(new Error('Network error — the upload didn’t finish.'));
    xhr.send(file);
  });
}

/**
 * Uploads one file as `kind` ('photo' | 'video' | 'source').
 * @returns {Promise<{ url: string, name: string, size: number }>} url = what gets saved on the listing
 */
export async function uploadFile(file, { kind, driver, onProgress }) {
  const problem = uploadProblem(kind, file);
  if (problem) throw new Error(problem);
  if (driver === 'blob') {
    try {
      const blob = await upload(`${kind}/${safeName(file.name)}`, file, {
        access: 'public', // unguessable (random suffix); source files are still only ever streamed to buyers by /api/downloads
        handleUploadUrl: '/api/seller/uploads',
        clientPayload: JSON.stringify({ kind }),
        contentType: UPLOAD_RULES[kind].types[extensionOf(file.name)],
        multipart: file.size > 20 * MB,
        onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
      });
      return { url: blob.url, name: file.name, size: file.size };
    } catch (err) {
      throw new Error(String(err?.message ?? '').replace(/^Vercel Blob:\s*/, '') || 'The upload failed. Please try again.');
    }
  }
  if (driver === 'local') {
    const data = await putLocal(file, kind, onProgress);
    return { url: data.url, name: file.name, size: data.size ?? file.size };
  }
  throw new Error('File uploads aren’t set up on this site yet.');
}
