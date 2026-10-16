import { ProductGridSkeleton } from '@/components/ProductGrid';

// Shown instantly (streamed) while Server Components fetch data. Mirrors the homepage layout to avoid CLS.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <section className="border-b border-stone-200">
        <div className="flex gap-4 overflow-hidden pt-6 sm:pt-8 lg:hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="aspect-[4/5] w-44 shrink-0 rounded-2xl bg-stone-100 sm:w-52" />
          ))}
        </div>
        <div className="container-page grid items-center lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col items-center py-12 sm:py-16 lg:items-start lg:py-24">
            <div className="h-8 w-56 rounded-full bg-stone-100" />
            <div className="mt-6 h-12 w-full max-w-lg rounded-2xl bg-stone-100 sm:h-16" />
            <div className="mt-3 h-12 w-2/3 max-w-md rounded-2xl bg-stone-100 sm:h-16" />
            <div className="mt-6 h-5 w-full max-w-md rounded-full bg-stone-100" />
            <div className="mt-9 flex gap-3">
              <div className="h-12 w-36 rounded-full bg-stone-100" />
              <div className="h-12 w-44 rounded-full bg-stone-100" />
            </div>
          </div>
          <div className="hidden h-[min(46rem,calc(100svh-7.5rem))] min-h-[36rem] grid-cols-2 gap-5 overflow-hidden lg:grid">
            {[0, 1].map((col) => (
              <div key={col} className={`space-y-5 ${col ? '-mt-40' : ''}`}>
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="aspect-[4/5] rounded-2xl bg-stone-100" />
                ))}
              </div>
            ))}
          </div>
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
