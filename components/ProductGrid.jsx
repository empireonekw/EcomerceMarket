import ProductCard from '@/components/ProductCard';

// Portrait cards (components/ProductCard.jsx) about Etsy's size: two across on phones, then as many ~16rem+ columns as
// fit (four on a laptop beside the category column, five on big monitors), each stretched to share the row evenly.
const GRID = 'grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] sm:gap-x-5';

/**
 * `emptyMessage` / `emptyHint` / `emptyAction` (e.g. a link) fill the box shown when there are no products.
 */
export default function ProductGrid({
  products,
  preloadCount = 0,
  emptyMessage = 'No products found.',
  emptyHint = 'Try a different search or category.',
  emptyAction,
}) {
  if (!products?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
        <p className="font-medium">{emptyMessage}</p>
        {emptyHint && <p className="mt-1 text-sm text-stone-500">{emptyHint}</p>}
        {emptyAction && <div className="mt-5">{emptyAction}</div>}
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
          <div className="aspect-[4/5] rounded-2xl bg-stone-100" />
          <div className="pt-3">
            <div className="h-4 w-1/3 rounded-full bg-stone-100" />
            <div className="mt-2 h-5 w-5/6 rounded-full bg-stone-100" />
            <div className="mt-2 h-4 w-1/2 rounded-full bg-stone-100" />
            <div className="mt-2.5 h-6 w-1/4 rounded-full bg-stone-100" />
            <div className="mt-3 h-10 w-32 rounded-full bg-stone-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}
