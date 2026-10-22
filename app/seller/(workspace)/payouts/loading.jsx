import { DashboardPageSkeleton, HeaderSkeleton, PanelSkeleton, StatsSkeleton } from '@/components/dashboard/Skeletons';

export default function Loading() {
  return (
    <DashboardPageSkeleton label="Loading payouts">
      <HeaderSkeleton />
      <StatsSkeleton count={3} />
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={4} />
      </div>
    </DashboardPageSkeleton>
  );
}
