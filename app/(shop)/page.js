import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ProductGrid from '@/components/ProductGrid';
import HeroShowcase from '@/components/home/HeroShowcase';
import FeatureMarquee from '@/components/home/FeatureMarquee';
import FormatStrip from '@/components/home/FormatStrip';
import CategoryIcon from '@/components/CategoryIcon';
import Reviews from '@/components/home/Reviews';
import SectionHeading from '@/components/home/SectionHeading';
import TalkToSellers from '@/components/home/TalkToSellers';
import { getProducts } from '@/lib/data/products';
import { getCategories } from '@/lib/data/categories';
import { categoryHref } from '@/lib/category-tree';

// Flat pastel panels for the category tiles, in order (Tailwind needs the full class names).
const TINTS = ['bg-brand-50', 'bg-tint-mint', 'bg-tint-butter', 'bg-tint-sky', 'bg-tint-blush', 'bg-tint-sage'];

// ISR: served as static HTML from the cache, regenerated at most every 5 minutes
// (and immediately after an admin creates a product — see POST /api/products).
export const revalidate = 300;

export default async function HomePage() {
  // Same data function that powers GET /api/products — Server Components query MongoDB
  // directly instead of making an HTTP round-trip to their own API.
  const [{ items: latest }, allCategories] = await Promise.all([getProducts({ sort: 'newest', limit: 6 }), getCategories()]);
  const categories = allCategories.filter((c) => !c.parent); // main categories; counts include their sub-categories

  return (
    <>
      <HeroShowcase />
      <FormatStrip />

      {/* ---------------- Shop by category ---------------- */}
      {categories.length > 0 && (
        <section className="container-page pt-20 sm:pt-28" aria-labelledby="categories-heading">
          <SectionHeading
            id="categories-heading"
            eyebrow="Browse"
            title="Shop by category"
            description="Every product is reviewed by our team before it goes live."
          />
          <ul className={`mt-10 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 ${categories.length % 3 === 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
            {categories.map((c, i) => (
              <li key={c._id}>
                <Link href={categoryHref(c)} className={`group flex h-full min-h-56 flex-col rounded-2xl p-6 sm:p-7 ${TINTS[i % TINTS.length]}`}>
                  <span className="grid size-11 place-items-center rounded-full bg-white text-gray-900 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                    <CategoryIcon slug={c.slug} />
                  </span>
                  <span className="mt-8 font-serif text-2xl tracking-tight text-gray-900">{c.name}</span>
                  {c.description && <span className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-stone-600">{c.description}</span>}
                  <span className="mt-auto flex items-center justify-between pt-6 text-sm text-stone-700">
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
        <SectionHeading id="latest-heading" eyebrow="Just added" title="Latest products" description="Fresh from independent creators this week.">
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
