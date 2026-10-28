import DashboardShell from '@/components/dashboard/DashboardShell';
import { ToastProvider } from '@/components/dashboard/Toaster';
import { MessagingProvider } from '@/components/messages/MessagingProvider';
import { requireSellerStore } from '@/lib/auth';

/**
 * Seller workspace shell. Sellers without a shop are sent to /seller/onboarding first.
 * Pages re-check the session themselves (layouts don't re-run on client navigation).
 */
export default async function SellerWorkspaceLayout({ children }) {
  const seller = await requireSellerStore();

  return (
    <ToastProvider>
      {/* Live inbox: unread badge in the sidebar + real-time Messages page. */}
      <MessagingProvider>
        <DashboardShell area="seller" user={seller}>
          {children}
        </DashboardShell>
      </MessagingProvider>
    </ToastProvider>
  );
}
