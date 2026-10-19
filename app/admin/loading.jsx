import { DashboardPageSkeleton, HeaderSkeleton, PanelSkeleton, StatsSkeleton } from '@/components/dashboard/Skeletons';

// Default for admin routes without their own loading.jsx (dashboard overview, add/edit product).
export default function AdminLoading() {
  return (
    <DashboardPageSkeleton>
      <HeaderSkeleton action />
      <StatsSkeleton />
      <div className="mt-4">
        <StatsSkeleton count={3} />
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={5} />
      </div>
    </DashboardPageSkeleton>
  );
}
