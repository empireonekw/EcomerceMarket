export default function ProfileLoading() {
  return (
    <div className="container-page animate-pulse py-10 sm:py-14" aria-busy="true" aria-label="Loading your account">
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-full bg-stone-200" />
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-stone-200" />
          <div className="h-4 w-64 rounded bg-stone-200" />
        </div>
      </div>
      <div className="mt-8 h-10 w-64 rounded bg-stone-200" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-stone-200" />
        ))}
      </div>
    </div>
  );
}
