export default function ProfileLoading() {
  return (
    <div className="bg-canvas">
      <div className="container-page grid grid-cols-1 animate-pulse gap-8 py-8 sm:py-12 lg:grid-cols-[15rem_1fr]" aria-busy="true" aria-label="Loading your account">
        <div className="space-y-3">
          <div className="h-16 rounded-2xl bg-white" />
          <div className="h-9 rounded-xl bg-stone-200/70" />
          <div className="h-9 rounded-xl bg-stone-200/70" />
        </div>
        <div>
          <div className="h-10 w-56 rounded-lg bg-stone-200/70" />
          <div className="mt-2 h-4 w-72 rounded bg-stone-200/70" />
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white" />
            ))}
          </div>
          <div className="mt-8 space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
