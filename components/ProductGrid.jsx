import ProductCard from '@/components/ProductCard';

// Shop grid of tall (4:5) cards: one across on small phones, two from 480px, three on laptops, four on wide screens.
const GRID = 'grid grid-cols-1 gap-x-5 gap-y-10 min-[480px]:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-12 xl:grid-cols-4';

export default function ProductGrid({ products, preloadCount = 0, emptyMessage = 'No products found.' }) {
  if (!products?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
        <p className="font-medium">{emptyMessage}</p>
        <p className="mt-1 text-sm text-stone-500">Try a different search or category.</p>
      </div>
    );
  }

  return (
    <ul className={GRID}>
      {products.map((product, i) => (
        <li key={product._id}>
          <ProductCard product={product} preload={i < preloadCount} />
        </li>
      ))}
    </ul>
  );
}

/** Mirrors ProductCard's exact dimensions so content doesn't shift when data arrives (no CLS). */
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <ul className={GRID} aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="animate-pulse">
          <div className="aspect-[4/5] rounded-[1.4rem] bg-stone-100" />
          <div className="px-1 pt-4">
            <div className="h-3 w-1/4 rounded-full bg-stone-100" />
            <div className="mt-3 h-6 w-4/5 rounded-full bg-stone-100" />
            <div className="mt-2.5 h-4 w-full rounded-full bg-stone-100" />
            <div className="mt-3.5 flex items-center justify-between border-t border-dashed border-stone-200 pt-3">
              <div className="h-7 w-20 rounded-full bg-stone-100" />
              <div className="h-9 w-20 rounded-full bg-stone-100" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
