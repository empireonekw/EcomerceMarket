import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import CategoryIcon from '@/components/CategoryIcon';
import Reveal from '@/components/Reveal';
import { Eyebrow, Glow, Sparkle } from '@/components/home/Editorial';
import { categoryHref } from '@/lib/category-tree';

// Quick catalog searches shown under the list (each runs a real search).
const SEARCHES = ['Notion', 'Canva', 'Figma', 'PDF', 'Planner', 'Icons'];

/**
 * "Shop by category" as a calm index: heading and a short line on the left, one row per category on the right
 * (icon, name, product count, arrow), then a few popular searches. Reads the same with one category or twenty.
 */
export default function Categories({ categories, productCount }) {
  return (
    <section className="container-page relative isolate pt-24 sm:pt-32" aria-labelledby="categories-heading">
      <Glow className="top-28 left-16 size-64 bg-brand-100/80" />
      <Sparkle className="top-32 left-[30%] hidden size-5 text-brand-500 lg:block" />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-20">
        <Reveal>
          <Eyebrow>Browse the catalog</Eyebrow>
          <h2 id="categories-heading" className="mt-4 font-serif text-[2.25rem] leading-[1.05] tracking-[-0.025em] text-ink sm:text-[3rem]">
            Shop by category
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-stone-600">Every product is reviewed by our team before it goes live.</p>
          <Link href="/products" className="btn btn-md btn-dark mt-7">
            All {productCount.toLocaleString('en-US')} products
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
        </Reveal>

        <div>
          <ul className="border-t border-stone-200">
            {categories.map((c, i) => (
              <Reveal as="li" key={c._id} delay={80 + i * 70} className="border-b border-stone-200">
                <Link href={categoryHref(c)} className="group flex items-center gap-3 py-5 transition-colors sm:gap-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full sm:size-12 bg-brand-50 text-brand-700 transition-colors group-hover:bg-brand-500 group-hover:text-ink">
                    <CategoryIcon slug={c.slug} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-xl tracking-[-0.02em] break-words text-ink sm:text-2xl">{c.name}</span>
                    {c.description && <span className="mt-0.5 block truncate text-sm text-stone-500">{c.description}</span>}
                  </span>
                  <span className="shrink-0 text-sm text-stone-500 tabular-nums">
                    {c.totalCount} {c.totalCount === 1 ? 'product' : 'products'}
                  </span>
                  <ArrowUpRight size={20} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-stone-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                </Link>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={200} className="mt-8">
            <p className="text-sm text-stone-500">Popular searches</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SEARCHES.map((q) => (
                <li key={q}>
                  <Link
                    href={`/products?q=${encodeURIComponent(q.toLowerCase())}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-sm text-stone-700 transition-colors hover:border-ink hover:text-ink"
                  >
                    <Search size={13} strokeWidth={2} aria-hidden="true" className="text-stone-400" />
                    {q}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
