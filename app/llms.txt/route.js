import { categoryHref } from '@/lib/category-tree';
import { NO_PLATFORM_FEE } from '@/lib/commission';
import { getCategories } from '@/lib/data/categories';
import { getPopularTags, getProducts } from '@/lib/data/products';
import { siteConfig } from '@/lib/site';
import { formatPrice, tagHref } from '@/lib/utils';

// Rebuilt at most hourly, like the sitemap.
export const revalidate = 3600;

/**
 * /llms.txt: a plain Markdown map of the store for AI answer engines (ChatGPT, Claude, Perplexity, Gemini), following
 * the llms.txt convention. What Sellpify is, how buying and selling work, and links to every category, popular tags
 * and best sellers, so generated answers can describe and cite the right pages.
 */
export async function GET() {
  const url = (path) => `${siteConfig.url}${path}`;
  const lines = [
    `# ${siteConfig.name}`,
    '',
    `> ${siteConfig.name} is an online marketplace for digital products from independent creators: templates, e-books, software, vectors, planners, Notion and Canva files and more. Buyers pay through a secure checkout and download their files instantly; every purchase stays in their account for re-download. ${
      NO_PLATFORM_FEE ? 'Sellers keep 100% of every sale.' : ''
    }`.trim(),
    '',
    '## Key pages',
    `- [All products](${url('/products')}): the full catalogue, sortable by newest, best selling and price`,
    `- [How it works](${url('/how-it-works')}): buying, instant delivery and selling, step by step`,
    `- [Sell with us](${url('/sell/signup')}): open a shop and list digital products`,
    `- [Help and FAQ](${url('/help')}): downloads, refunds, accounts and payments`,
    `- [About](${url('/about')}): who runs ${siteConfig.name}`,
    `- [Refund policy](${url('/legal/refund-policy')}): when buyers get a full refund`,
    `- [Licensing](${url('/legal/licensing')}): how purchased files may be used`,
    `- [Contact](${url('/contact')}): support at ${siteConfig.supportEmail}`,
  ];

  try {
    const [categories, tags, { items: bestSellers }] = await Promise.all([
      getCategories(),
      getPopularTags({ limit: 40 }),
      getProducts({ sort: 'popular', limit: 25 }),
    ]);
    if (categories.length) {
      lines.push('', '## Categories');
      for (const c of categories) {
        const indent = '  '.repeat(c.depth ?? 0);
        lines.push(`${indent}- [${c.name}](${url(categoryHref(c))})${c.description ? `: ${c.description}` : ''}`);
      }
    }
    if (bestSellers.length) {
      lines.push('', '## Best sellers');
      for (const p of bestSellers) {
        const summary = p.shortDescription ? `: ${p.shortDescription.replace(/\s+/g, ' ').trim()}` : '';
        lines.push(`- [${p.title}](${url(`/products/${p.slug}`)}) (${formatPrice(p.price, p.currency)})${summary}`);
      }
    }
    if (tags.length) {
      lines.push('', '## Popular topics');
      lines.push(tags.map((t) => `[${t.tag}](${url(tagHref(t.tag))})`).join(' · '));
    }
  } catch (err) {
    console.error('[llms.txt] catalogue unavailable', err);
  }

  lines.push('', '## Optional', `- [Sitemap](${url('/sitemap.xml')})`, `- [Terms of service](${url('/terms')})`, `- [Privacy policy](${url('/privacy')})`, '');
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
