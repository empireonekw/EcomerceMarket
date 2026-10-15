import DashboardShell from '@/components/dashboard/DashboardShell';
import { ToastProvider } from '@/components/dashboard/Toaster';
import { requireSellerStore } from '@/lib/auth';

/**
 * Seller workspace shell. Sellers without a shop are sent to /seller/onboarding first.
 * Pages re-check the session themselves (layouts don't re-run on client navigation).
 */
export default async function SellerWorkspaceLayout({ children }) {
  const seller = await requireSellerStore();

  return (
    <ToastProvider>
      <DashboardShell area="seller" user={seller}>
        {children}
      </DashboardShell>
    </ToastProvider>
  );
}
