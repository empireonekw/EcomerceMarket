import { DashboardPageSkeleton, HeaderSkeleton, PanelSkeleton, StatsSkeleton, TableSkeleton } from '@/components/dashboard/Skeletons';

export default function Loading() {
  return (
    <DashboardPageSkeleton label="Loading payouts">
      <HeaderSkeleton />
      <StatsSkeleton />
      <div className="mt-8">
        <TableSkeleton rows={6} cols={5} thumb={false} />
      </div>
      <div className="mt-8">
        <PanelSkeleton rows={4} />
      </div>
    </DashboardPageSkeleton>
  );
}
