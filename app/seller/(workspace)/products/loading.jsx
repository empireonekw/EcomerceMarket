import { DashboardPageSkeleton, HeaderSkeleton, TableSkeleton } from '@/components/dashboard/Skeletons';

export default function Loading() {
  return (
    <DashboardPageSkeleton label="Loading your products">
      <HeaderSkeleton action />
      <TableSkeleton rows={8} cols={6} />
    </DashboardPageSkeleton>
  );
}
