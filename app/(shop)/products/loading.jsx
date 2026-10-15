import { ProductGridSkeleton } from '@/components/ProductGrid';

export default function ProductsLoading() {
  return (
    <div className="container-page py-10 sm:py-14">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-stone-200" />
      <div className="mt-3 h-4 w-24 animate-pulse rounded bg-stone-200" />
      <div className="mt-8 flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-stone-200" />
        ))}
      </div>
      <div className="mt-8">
        <ProductGridSkeleton count={12} />
      </div>
    </div>
  );
}
