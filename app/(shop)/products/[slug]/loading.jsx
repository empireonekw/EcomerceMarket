export default function ProductLoading() {
  return (
    <div className="container-page animate-pulse py-8 sm:py-12" aria-busy="true">
      <div className="h-4 w-40 rounded bg-stone-200" />
      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="aspect-[4/3] rounded-2xl bg-stone-200" />
        <div className="space-y-4">
          <div className="h-10 w-4/5 rounded-lg bg-stone-200" />
          <div className="h-5 w-full rounded bg-stone-200" />
          <div className="h-5 w-2/3 rounded bg-stone-200" />
          <div className="h-8 w-20 rounded-full bg-stone-200" />
          <div className="h-12 w-full rounded-full bg-stone-200" />
          <div className="h-40 w-full rounded-2xl bg-stone-200" />
        </div>
      </div>
    </div>
  );
}
