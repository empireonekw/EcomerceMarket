import { ChartSkeleton, DashboardPageSkeleton, PanelSkeleton, StatsSkeleton } from '@/components/dashboard/Skeletons';

export default function Loading() {
  return (
    <DashboardPageSkeleton label="Loading user">
      <div className="h-4 w-20 rounded-full bg-stone-200/80" />
      <div className="mb-8 mt-4 flex items-center gap-4">
        <div className="size-14 rounded-full bg-stone-200/80" />
        <div>
          <div className="h-9 w-64 rounded-full bg-stone-200/80" />
          <div className="mt-3 h-4 w-80 max-w-full rounded-full bg-stone-200/80" />
        </div>
      </div>
      <StatsSkeleton />
      <div className="mt-8">
        <ChartSkeleton />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={6} />
      </div>
    </DashboardPageSkeleton>
  );
}
