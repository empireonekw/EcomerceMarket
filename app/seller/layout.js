import DashboardShell from '@/components/dashboard/DashboardShell';
import { ToastProvider } from '@/components/dashboard/Toaster';
import { requireSeller } from '@/lib/auth';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: { default: 'Seller', template: `%s · ${siteConfig.name} Seller` },
  robots: { index: false, follow: false },
};

/** Seller dashboard shell. Pages re-check the session themselves (layouts don't re-run on navigation). */
export default async function SellerLayout({ children }) {
  const seller = await requireSeller();

  return (
    <ToastProvider>
      <DashboardShell area="seller" user={seller}>
        {children}
      </DashboardShell>
    </ToastProvider>
  );
}
