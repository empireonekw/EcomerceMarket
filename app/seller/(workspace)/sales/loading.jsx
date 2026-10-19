import { DashboardPageSkeleton, FilterBarSkeleton, HeaderSkeleton, StatsSkeleton, TableSkeleton } from '@/components/dashboard/Skeletons';

export default function Loading() {
  return (
    <DashboardPageSkeleton label="Loading sales">
      <HeaderSkeleton />
      <StatsSkeleton />
      <FilterBarSkeleton />
      <TableSkeleton rows={10} cols={7} thumb={false} />
    </DashboardPageSkeleton>
  );
}
