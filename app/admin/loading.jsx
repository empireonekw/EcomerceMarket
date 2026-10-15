export default function AdminLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 rounded-lg bg-stone-200" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-stone-200" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-stone-200" />
        ))}
      </div>
      <div className="mt-8 h-96 rounded-2xl bg-stone-200" />
    </div>
  );
}
