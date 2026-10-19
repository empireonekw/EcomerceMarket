import { DashboardPageSkeleton, FilterBarSkeleton, HeaderSkeleton, StatsSkeleton, TableSkeleton } from '@/components/dashboard/Skeletons';

export default function Loading() {
  return (
    <DashboardPageSkeleton label="Loading users">
      <HeaderSkeleton />
      <StatsSkeleton />
      <FilterBarSkeleton />
      <TableSkeleton rows={8} cols={7} thumb={false} />
    </DashboardPageSkeleton>
  );
}
