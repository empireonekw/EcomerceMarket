import { DashboardPageSkeleton, FilterBarSkeleton, HeaderSkeleton, TableSkeleton } from '@/components/dashboard/Skeletons';

export default function Loading() {
  return (
    <DashboardPageSkeleton label="Loading orders">
      <HeaderSkeleton action />
      <FilterBarSkeleton />
      <TableSkeleton rows={10} cols={5} thumb={false} />
    </DashboardPageSkeleton>
  );
}
