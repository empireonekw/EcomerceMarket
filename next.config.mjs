import { REMOTE_IMAGE_PATTERNS } from './lib/image-hosts.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  images: {
    // Serve modern formats; AVIF first, WebP fallback.
    formats: ['image/avif', 'image/webp'],
    // Cache optimized images for 30 days (cover images rarely change).
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Only these hosts may be optimized by next/image. Edit the list in lib/image-hosts.js.
    remotePatterns: REMOTE_IMAGE_PATTERNS,
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
