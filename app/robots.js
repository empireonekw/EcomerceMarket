import { siteConfig } from '@/lib/site';

const PRIVATE = ['/admin', '/seller', '/profile', '/messages', '/checkout', '/api/'];
const AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended'];

/** /robots.txt — crawl the storefront, skip private areas, and find everything via the sitemap. */
export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      // Answer engines (ChatGPT, Claude, Perplexity, Gemini…) are welcome on the public catalogue too; /llms.txt is their map.
      { userAgent: AI_CRAWLERS, allow: ['/', '/llms.txt'], disallow: PRIVATE },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
