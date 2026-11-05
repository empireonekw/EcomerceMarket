import { cookies } from 'next/headers';
import DashboardShell, { SIDEBAR_COOKIE } from '@/components/dashboard/DashboardShell';
import { ToastProvider } from '@/components/dashboard/Toaster';
import { MessagingProvider } from '@/components/messages/MessagingProvider';
import VerifyIdentityPrompt from '@/components/seller/VerifyIdentityPrompt';
import { requireSellerStore } from '@/lib/auth';
import { getVerificationState } from '@/lib/data/seller-verification';

/**
 * Seller workspace shell. Sellers without a shop are sent to /seller/onboarding first.
 * Pages re-check the session themselves (layouts don't re-run on client navigation).
 */
export default async function SellerWorkspaceLayout({ children }) {
  const seller = await requireSellerStore();
  // Identity is only asked for after the first sale (or after a rejected attempt): then a pop-up invites them to verify.
  const verification = await getVerificationState(seller.id);
  const askToVerify = (verification.requested && !verification.status) || verification.status === 'rejected';

  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === 'collapsed';

  return (
    <ToastProvider>
      {/* Live inbox: unread badge in the sidebar + real-time Messages page. */}
      <MessagingProvider>
        <DashboardShell area="seller" user={seller} sidebarCollapsed={sidebarCollapsed}>
          {children}
          {askToVerify && <VerifyIdentityPrompt />}
        </DashboardShell>
      </MessagingProvider>
    </ToastProvider>
  );
}
