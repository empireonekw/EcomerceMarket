import { DashboardPageSkeleton, FilterBarSkeleton, HeaderSkeleton, PanelSkeleton } from '@/components/dashboard/Skeletons';

export default function Loading() {
  return (
    <DashboardPageSkeleton label="Loading messages">
      <HeaderSkeleton />
      <FilterBarSkeleton />
      <PanelSkeleton rows={6} />
    </DashboardPageSkeleton>
  );
}
