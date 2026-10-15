export default function ReceiptLoading() {
  return (
    <div className="container-page max-w-4xl animate-pulse py-10 sm:py-14" aria-busy="true" aria-label="Loading your downloads">
      <div className="mx-auto size-14 rounded-full bg-stone-200" />
      <div className="mx-auto mt-5 h-9 w-3/4 max-w-md rounded-lg bg-stone-200" />
      <div className="mx-auto mt-3 h-5 w-2/3 max-w-sm rounded bg-stone-200" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-stone-200" />
        ))}
      </div>
      <div className="mt-10 h-64 rounded-2xl bg-stone-200" />
    </div>
  );
}
