// Loading placeholders for dashboard routes (used by loading.jsx files). Shapes mirror the real pages so
// nothing jumps when data arrives. aria-busy on the wrapper; the shapes themselves are decorative.

const bar = 'rounded-full bg-stone-200/80';

export function DashboardPageSkeleton({ children, label = 'Loading' }) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

export function HeaderSkeleton({ action = false }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <div className={`h-9 w-56 ${bar}`} />
        <div className={`mt-3 h-4 w-80 max-w-full ${bar}`} />
      </div>
      {action && <div className="hidden h-10 w-36 rounded-full bg-stone-200/80 sm:block" />}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${count === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className={`h-3.5 w-24 ${bar}`} />
            <div className="size-9 rounded-xl bg-stone-200/80" />
          </div>
          <div className={`mt-4 h-8 w-28 ${bar}`} />
          <div className={`mt-2 h-3.5 w-36 ${bar}`} />
        </div>
      ))}
    </div>
  );
}

export function FilterBarSkeleton() {
  return (
    <div className="mb-5 mt-8 flex flex-wrap gap-2">
      <div className="h-10 w-72 max-w-full rounded-full bg-stone-200/80" />
      <div className="h-10 w-32 rounded-full bg-stone-200/80" />
      <div className="h-10 w-24 rounded-full bg-stone-200/80" />
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5, thumb = true }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="flex gap-6 border-b border-stone-200 bg-stone-50 px-5 py-3.5">
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className={`h-3 ${i === 0 ? 'w-40' : 'w-16'} ${bar}`} />
        ))}
      </div>
      <div className="divide-y divide-stone-100">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-6 px-5 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {thumb && <div className="h-10 w-14 shrink-0 rounded-lg bg-stone-200/80" />}
              <div className="min-w-0 flex-1">
                <div className={`h-3.5 w-3/5 ${bar}`} />
                <div className={`mt-2 h-3 w-2/5 ${bar}`} />
              </div>
            </div>
            {Array.from({ length: cols - 1 }, (_, c) => (
              <div key={c} className={`hidden h-3.5 w-16 md:block ${bar}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex justify-between border-b border-stone-200 px-5 py-4">
        <div className={`h-4 w-40 ${bar}`} />
        <div className={`h-4 w-32 ${bar}`} />
      </div>
      <div className="flex h-56 items-end gap-3 px-16 pb-10 pt-6">
        {[35, 50, 20, 65, 45, 80, 30, 55, 70, 40, 60, 90].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-[4px] bg-stone-200/80" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function PanelSkeleton({ rows = 5 }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-5 py-4">
        <div className={`h-4 w-32 ${bar}`} />
      </div>
      <div className="space-y-4 p-5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-8 shrink-0 rounded-full bg-stone-200/80" />
            <div className="flex-1">
              <div className={`h-3.5 w-3/4 ${bar}`} />
              <div className={`mt-2 h-3 w-1/3 ${bar}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
