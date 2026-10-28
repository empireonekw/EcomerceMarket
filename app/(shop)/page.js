import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ProductGrid from '@/components/ProductGrid';
import HeroShowcase from '@/components/home/HeroShowcase';
import FeatureMarquee from '@/components/home/FeatureMarquee';
import CategoryIcon from '@/components/CategoryIcon';
import Reviews from '@/components/home/Reviews';
import SectionHeading from '@/components/home/SectionHeading';
import TalkToSellers from '@/components/home/TalkToSellers';
import { getHeroProducts, getProducts, getStorefrontStats } from '@/lib/data/products';
import { getCategories } from '@/lib/data/categories';

// ISR: served as static HTML from the cache, regenerated at most every 5 minutes
// (and immediately after an admin creates a product — see POST /api/products).
export const revalidate = 300;

export default async function HomePage() {
  // Same data function that powers GET /api/products — Server Components query MongoDB
  // directly instead of making an HTTP round-trip to their own API.
  const [{ items: latest }, allCategories, heroProducts, stats] = await Promise.all([
    getProducts({ sort: 'newest', limit: 6 }),
    getCategories(),
    getHeroProducts(12),
    getStorefrontStats(),
  ]);
  const categories = allCategories.filter((c) => !c.parent); // main categories; counts include their sub-categories

  return (
    <>
      <HeroShowcase products={heroProducts} stats={stats} />

      {/* ---------------- Shop by category ---------------- */}
      {categories.length > 0 && (
        <section className="container-page pt-20 sm:pt-28" aria-labelledby="categories-heading">
          <SectionHeading id="categories-heading" title="Shop by category" description="Every product is reviewed by our team before it goes live." />
          <ul className="mt-10 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c._id}>
                <Link
                  href={`/products?category=${c.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-6 transition-[box-shadow,border-color] hover:border-transparent hover:shadow-lift"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-stone-100 text-black transition-colors group-hover:bg-brand-600 group-hover:text-white">
                    <CategoryIcon slug={c.slug} />
                  </span>
                  <span className="headline mt-8 text-2xl">{c.name}</span>
                  {c.description && <span className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-stone-500">{c.description}</span>}
                  <span className="mt-auto flex items-center justify-between pt-6 text-sm text-stone-600">
                    {c.totalCount} {c.totalCount === 1 ? 'product' : 'products'}
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:text-black" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------------- Why shop with us (scrolling banner) ---------------- */}
      <FeatureMarquee />

      {/* ---------------- Latest products ---------------- */}
      <section className="container-page pt-20 sm:pt-28" aria-labelledby="latest-heading">
        <SectionHeading id="latest-heading" title="Latest products" description="Fresh from independent creators this week.">
          <Link href="/products?sort=newest" className="btn btn-md btn-outline">
            View all
          </Link>
        </SectionHeading>
        <div className="mt-10">
          <ProductGrid products={latest} emptyMessage="No products yet — run `npm run seed`." />
        </div>
      </section>

      {/* ---------------- Message sellers ---------------- */}
      <TalkToSellers />

      {/* ---------------- Reviews ---------------- */}
      <Reviews />
    </>
  );
}
