// Single source of truth for remote image hosts.
// Used by next.config.mjs (next/image allow-list) AND by admin product validation,
// so a product can never be saved with a cover image that next/image would refuse to render.

export const REMOTE_IMAGE_PATTERNS = [
  { protocol: 'https', hostname: 'images.unsplash.com' },
  { protocol: 'https', hostname: '**.amazonaws.com' }, // S3 public cover images
  { protocol: 'https', hostname: '**.r2.dev' }, // Cloudflare R2 public buckets
  { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' }, // seller uploads (Vercel Blob, lib/uploads.js)
  { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google avatars
  { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
];

function hostMatches(pattern, hostname) {
  if (pattern.startsWith('**.')) return hostname.endsWith(pattern.slice(2)); // any depth of subdomain
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return hostname.endsWith(suffix) && !hostname.slice(0, -suffix.length).includes('.');
  }
  return hostname === pattern;
}

/** Seller uploads stored on this server when Vercel Blob isn't configured (served by app/api/files). */
export const LOCAL_MEDIA_PREFIX = '/api/files/media/';
export const isLocalMediaPath = (value) => typeof value === 'string' && /^\/api\/files\/media\/[\w.-]+$/.test(value);

export function isAllowedImageUrl(value) {
  if (isLocalMediaPath(value)) return true;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return REMOTE_IMAGE_PATTERNS.some(
    (p) => url.protocol === `${p.protocol}:` && hostMatches(p.hostname, url.hostname),
  );
}
