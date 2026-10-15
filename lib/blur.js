import sharp from 'sharp';
import { isAllowedImageUrl } from './image-hosts.js';

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

/**
 * Generates a tiny (~16px) WebP data URL from a remote image, for next/image `placeholder="blur"`.
 * Computed once at write time and stored on the product, so rendering never pays for it.
 * Only fetches from allow-listed hosts (prevents SSRF through admin-supplied URLs).
 * Returns null on any failure — the UI falls back to a neutral placeholder.
 */
export async function createBlurDataURL(imageUrl) {
  if (!imageUrl || !isAllowedImageUrl(imageUrl)) return null;

  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null;
    if (Number(res.headers.get('content-length')) > MAX_SOURCE_BYTES) return null;

    const input = Buffer.from(await res.arrayBuffer());
    const output = await sharp(input).resize(16, 16, { fit: 'inside' }).webp({ quality: 50 }).toBuffer();
    return `data:image/webp;base64,${output.toString('base64')}`;
  } catch {
    return null;
  }
}
