import { ProductGridSkeleton } from '@/components/ProductGrid';

// Shown instantly (streamed) while Server Components fetch data. Mirrors the homepage layout to avoid CLS.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      {/* Hero: centred intro (components/home/HeroShowcase.jsx); the framing photos load in with the page. */}
      <section className="border-b border-stone-200 bg-paper">
        <div className="container-page flex flex-col items-center py-14 sm:py-20 lg:min-h-[max(38rem,calc(100svh-6.1rem))] lg:justify-center lg:py-16">
          <div className="h-3 w-56 rounded-full bg-stone-200/70" />
          <div className="mt-6 h-12 w-full max-w-xl rounded-2xl bg-stone-200/70 sm:h-16" />
          <div className="mt-3 h-12 w-2/3 max-w-md rounded-2xl bg-stone-200/70 sm:h-16" />
          <div className="mt-6 h-5 w-full max-w-md rounded-full bg-stone-200/70" />
          <div className="mt-9 h-14 w-full max-w-lg rounded-full bg-white" />
          <div className="mt-14 h-56 w-full max-w-md rounded-3xl bg-stone-200/50 sm:h-72 lg:hidden" />
        </div>
      </section>

      <section className="container-page pt-20 sm:pt-28">
        <div className="h-10 w-72 rounded-2xl bg-stone-100" />
        <div className="mt-10 grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-56 rounded-2xl border border-stone-200" />
          ))}
        </div>
      </section>

      <section className="container-page pt-20 sm:pt-28">
        <div className="h-10 w-64 rounded-2xl bg-stone-100" />
        <div className="mt-10">
          <ProductGridSkeleton count={6} />
        </div>
      </section>
    </div>
  );
}
