import { DashboardPageSkeleton, FilterBarSkeleton, HeaderSkeleton, TableSkeleton } from '@/components/dashboard/Skeletons';

export default function Loading() {
  return (
    <DashboardPageSkeleton label="Loading products">
      <HeaderSkeleton action />
      <FilterBarSkeleton />
      <TableSkeleton rows={10} cols={5} thumb={true} />
    </DashboardPageSkeleton>
  );
}
