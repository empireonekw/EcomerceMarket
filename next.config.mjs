import { REMOTE_IMAGE_PATTERNS } from './lib/image-hosts.js';

const isProd = process.env.NODE_ENV === 'production';
const SOCKET_ORIGIN = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').origin.replace(/^http/, 'ws');

/**
 * Content-Security-Policy. Scripts only from this site — no third-party script can run, even if injected into the
 * HTML. 'unsafe-inline' stays for Next.js's own inline bootstrap scripts: the nonce alternative forces every page to
 * render per request and would switch off the caching the storefront relies on (node_modules/next/dist/docs/01-app/
 * 02-guides/content-security-policy.md). React needs 'unsafe-eval' in development only.
 * connect-src: this site (API + Socket.IO) and Vercel Blob for seller uploads. No plugins, no framing, forms post here.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  // The live-chat socket is same-origin; its wss:// address is listed too because older Safari doesn't count ws(s) as 'self'.
  `connect-src 'self' ${SOCKET_ORIGIN} https://vercel.com https://*.blob.vercel-storage.com${isProd ? '' : ' ws: wss:'}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // scripts/deploy.sh builds into .next-build while the live site keeps serving .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  reactStrictMode: true,

  experimental: {
    // Keep visited dynamic pages (dashboards, lists) in the client router cache for 30s, so going back/forward
    // between them is instant. Mutations still call router.refresh(), which bypasses this cache.
    staleTimes: { dynamic: 30 },
  },
  poweredByHeader: false,

  images: {
    // Serve modern formats; AVIF first, WebP fallback.
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 30 days (cover images rarely change).
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Only these hosts may be optimized by next/image. Edit the list in lib/image-hosts.js.
    remotePatterns: REMOTE_IMAGE_PATTERNS,
  },

  // "Sell With Us" goes straight to seller sign-up; old /sell links are redirected before anything renders.
  // Seller "products" pages became "Listings".
  async redirects() {
    return [
      { source: '/sell', destination: '/sell/signup', permanent: true },
      { source: '/seller/products', destination: '/seller/listings', permanent: true },
      { source: '/seller/products/add', destination: '/seller/listings/new', permanent: true },
      { source: '/seller/products/:id/edit', destination: '/seller/listings/:id/edit', permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
          ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
