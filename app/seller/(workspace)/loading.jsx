import { ChartSkeleton, DashboardPageSkeleton, HeaderSkeleton, StatsSkeleton, TableSkeleton } from '@/components/dashboard/Skeletons';

// Seller dashboard shape; also the default for seller routes without their own loading.jsx.
export default function SellerLoading() {
  return (
    <DashboardPageSkeleton>
      <HeaderSkeleton action />
      <StatsSkeleton />
      <div className="mt-8">
        <ChartSkeleton />
      </div>
      <div className="mt-8">
        <TableSkeleton rows={4} cols={5} />
      </div>
    </DashboardPageSkeleton>
  );
}
