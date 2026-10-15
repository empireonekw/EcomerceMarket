import 'server-only';
import { isDemoCheckout } from '@/lib/payments';
import { siteConfig } from '@/lib/site';

const isHttpUrl = (v) => /^https?:\/\//i.test(v ?? '');

/**
 * Turns a product's private `downloadUrl` into something deliverable.
 *  - External links (deliveryType 'external' or any http(s) URL) → redirect.
 *  - Storage keys (e.g. "products/pack.zip") → short-lived signed URL from your bucket.
 *
 * @returns {Promise<{ type: 'redirect', url: string } | { type: 'placeholder', filename: string, body: string } | { type: 'unavailable' }>}
 */
export async function resolveDelivery(product) {
  const location = product.downloadUrl;

  if (product.deliveryType === 'external' || isHttpUrl(location)) {
    return { type: 'redirect', url: location };
  }

  const signed = await createSignedStorageUrl(location);
  if (signed) return { type: 'redirect', url: signed };

  // No storage configured: in local/demo mode, deliver a placeholder so the flow is testable end-to-end.
  if (isDemoCheckout()) {
    const base = location.split('/').pop() || 'download';
    return {
      type: 'placeholder',
      filename: `${base}.PLACEHOLDER.txt`,
      body: `${siteConfig.name} — demo delivery\n\nProduct: ${product.title}\nStorage key: ${location}\n\nConfigure createSignedStorageUrl() in lib/storage.js to deliver the real file.\n`,
    };
  }

  return { type: 'unavailable' };
}

/**
 * Hook for private object storage. Return a signed URL valid for a few minutes, or null.
 * Example (S3 / R2 via @aws-sdk/s3-request-presigner):
 *   return getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: 300 });
 */
async function createSignedStorageUrl(_key) {
  return null;
}
