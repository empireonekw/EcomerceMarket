import LiveFlow from '@/components/admin/LiveFlow';
import { PageHeader } from '@/components/dashboard/ui';
import { requireAdmin } from '@/lib/auth';
import { getSystemSnapshot } from '@/lib/data/monitor';

export const metadata = { title: 'System Health' };

/** Live flow of the whole site: what's healthy, what's being called too fast, and what's failing. */
export default async function SystemHealthPage() {
  await requireAdmin();
  const initial = await getSystemSnapshot();
  return (
    <>
      <PageHeader
        title="System Health"
        description="A live map of the site — every page area, API and service. Green is healthy, amber means calls are coming in too fast or slowly, red means something is failing. Updates every 5 seconds."
      />
      <LiveFlow initial={initial} />
    </>
  );
}
