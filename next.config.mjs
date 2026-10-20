import { REMOTE_IMAGE_PATTERNS } from './lib/image-hosts.js';

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
  async redirects() {
    return [{ source: '/sell', destination: '/sell/signup', permanent: true }];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
