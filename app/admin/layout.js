import DashboardShell from '@/components/dashboard/DashboardShell';
import { ToastProvider } from '@/components/dashboard/Toaster';
import { requireAdmin } from '@/lib/auth';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: { default: 'Admin', template: `%s · ${siteConfig.name} Admin` },
  robots: { index: false, follow: false },
};

/**
 * Admin portal shell. The session is verified here for the first render, but layouts don't re-run on
 * client navigation — so every admin page/data function ALSO authorizes itself (lib/data/admin.js).
 */
export default async function AdminLayout({ children }) {
  const admin = await requireAdmin();

  return (
    <ToastProvider>
      <DashboardShell area="admin" user={admin}>
        {children}
      </DashboardShell>
    </ToastProvider>
  );
}
