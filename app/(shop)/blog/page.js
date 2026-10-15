import Link from 'next/link';
import PageIntro from '@/components/PageIntro';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: 'Blog',
  description: `Guides, creator stories and product news from ${siteConfig.name}.`,
};

// No posts yet — this page is ready for a CMS or MDX source when content exists.
export default function BlogPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <PageIntro
        eyebrow="Blog"
        title="Stories, guides & news"
        description="Tips for getting the most out of digital products, creator spotlights and marketplace updates."
      />

      <div className="mt-16 rounded-2xl border border-dashed border-stone-300 px-6 py-20 text-center">
        <p className="headline text-2xl">No posts yet</p>
        <p className="mx-auto mt-2 max-w-md text-stone-500">Our first articles are on the way. In the meantime, see what’s new in the store.</p>
        <Link href="/products?sort=newest" className="btn btn-md btn-dark mt-8">
          Browse new arrivals
        </Link>
      </div>
    </div>
  );
}
