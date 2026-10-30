import Link from 'next/link';
import ProductGrid from '@/components/ProductGrid';
import HeroShowcase from '@/components/home/HeroShowcase';
import FormatStrip from '@/components/home/FormatStrip';
import Statement from '@/components/home/Statement';
import Categories from '@/components/home/Categories';
import WhyShop from '@/components/home/WhyShop';
import HowItWorks from '@/components/home/HowItWorks';
import CreatorNumber from '@/components/home/CreatorNumber';
import Reviews from '@/components/home/Reviews';
import Faq from '@/components/home/Faq';
import SectionHeading from '@/components/home/SectionHeading';
import TalkToSellers from '@/components/home/TalkToSellers';
import { getProducts } from '@/lib/data/products';
import { getCategories } from '@/lib/data/categories';
import Reveal from '@/components/Reveal';
import { siteConfig } from '@/lib/site';

// ISR: served as static HTML from the cache, regenerated at most every 5 minutes
// (and immediately after an admin creates a product, see POST /api/products).
export const revalidate = 300;

export const metadata = {
  description: `Shop templates, e-books, software, vectors and more from independent creators on ${siteConfig.name}. Secure checkout, instant download, and sellers keep 100% of every sale.`,
  alternates: { canonical: '/' },
};

// Who runs the site and how to search it: lets Google show the brand panel and a sitelinks search box, and gives
// AI answer engines a clean description to quote.
const SITE_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/icon.svg`,
    email: siteConfig.supportEmail,
    description: siteConfig.description,
    sameAs: siteConfig.social.map((s) => s.href),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteConfig.url}/#website`,
    name: siteConfig.name,
    url: siteConfig.url,
    publisher: { '@id': `${siteConfig.url}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${siteConfig.url}/products?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  },
];

/**
 * Homepage, top to bottom: hero · formats strip · why Sellpify · latest products · for creators · categories ·
 * why shop with us · how it works · talk to sellers · reviews · FAQ (the footer follows from the shop layout).
 */
export default async function HomePage() {
  // Same data function that powers GET /api/products: Server Components query MongoDB
  // directly instead of making an HTTP round-trip to their own API.
  const [{ items: latest }, allCategories] = await Promise.all([getProducts({ sort: 'newest', limit: 8 }), getCategories()]);
  const categories = allCategories.filter((c) => !c.parent); // main categories; counts include their sub-categories
  const productCount = categories.reduce((n, c) => n + (c.totalCount ?? 0), 0);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD).replace(/</g, '\\u003c') }} />
      <HeroShowcase />
      <FormatStrip />
      <Statement />

      {/* ---------------- Latest products ---------------- */}
      <section className="container-page pt-24 sm:pt-32" aria-labelledby="latest-heading">
        <SectionHeading id="latest-heading" eyebrow="Just added" title="Latest products" description="Fresh from independent creators this week.">
          <Link href="/products?sort=newest" className="btn btn-md btn-outline">
            View all
          </Link>
        </SectionHeading>
        <Reveal className="mt-10">
          <ProductGrid products={latest} emptyMessage="No products yet. Run `npm run seed`." />
        </Reveal>
      </section>

      <CreatorNumber />
      <Categories categories={categories} productCount={productCount} />
      <WhyShop />
      <HowItWorks />
      <TalkToSellers />
      <Reviews />
      <Faq />
    </>
  );
}
