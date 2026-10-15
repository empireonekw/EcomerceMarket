import ProductCard from '@/components/ProductCard';

const GRID = 'grid grid-cols-1 gap-x-6 gap-y-12 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

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
          <div className="aspect-[4/3] rounded-2xl bg-stone-100" />
          <div className="mt-4 h-5 w-4/5 rounded-full bg-stone-100" />
          <div className="mt-2 h-4 w-1/2 rounded-full bg-stone-100" />
          <div className="mt-4 flex items-center justify-between">
            <div className="h-6 w-14 rounded-full bg-stone-100" />
            <div className="h-9 w-20 rounded-full bg-stone-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}
