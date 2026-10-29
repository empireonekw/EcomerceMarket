/** Shown the instant a login / sign-up / password link is clicked, shaped like AuthCard so nothing jumps when it loads. */
export default function AuthLoading() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12" aria-busy="true" aria-label="Loading">
      <div className="w-full max-w-md animate-pulse">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-6 w-28 rounded-md bg-stone-200" />
          <div className="h-4 w-24 rounded bg-stone-200" />
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="h-7 w-44 rounded-lg bg-stone-200" />
          <div className="mt-2.5 h-4 w-64 rounded bg-stone-100" />
          <div className="mt-8 space-y-5">
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="h-4 w-20 rounded bg-stone-100" />
                <div className="mt-2 h-11 rounded-xl bg-stone-100" />
              </div>
            ))}
            <div className="h-11 rounded-full bg-brand-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
