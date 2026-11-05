import { ProductGridSkeleton } from '@/components/ProductGrid';

/** Mirrors the product list layout: breadcrumbs, category column, title row and the grid. */
export default function ProductsLoading() {
  return (
    <div className="container-wide py-6 sm:py-10">
      <div className="h-9 w-56 animate-pulse rounded-full bg-stone-100" />
      <div className="mt-6 grid grid-cols-1 gap-x-8 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="hidden space-y-3 lg:block">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-5 animate-pulse rounded-full bg-stone-100" style={{ width: `${55 + ((i * 17) % 40)}%` }} />
          ))}
        </div>
        <div className="min-w-0">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="h-9 w-56 animate-pulse rounded-lg bg-stone-100" />
              <div className="mt-2 h-4 w-20 animate-pulse rounded bg-stone-100" />
            </div>
            <div className="h-10 w-44 animate-pulse rounded-full bg-stone-100" />
          </div>
          <div className="mt-6">
            <ProductGridSkeleton count={12} />
          </div>
        </div>
      </div>
    </div>
  );
}
