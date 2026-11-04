import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthCard from '@/components/auth/AuthCard';
import RankkwConnectButtons from '@/components/auth/RankkwConnectButtons';
import { getCurrentUser } from '@/lib/auth';
import { rankkwCallback } from '@/lib/rankkw-link';

export const metadata = { title: 'Connect Rankkw', robots: { index: false } };

const STATE_RE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Rankkw sends sellers here to connect their Sellpify shop (lib/rankkw-link.js). Signed-out visitors log in first and
 * come back; accounts without a shop are asked to open one.
 */
export default async function ConnectRankkwPage({ searchParams }) {
  const params = await searchParams;
  const state = String(params.state ?? '');
  const origin = String(params.origin ?? '');
  if (!STATE_RE.test(state)) {
    return (
      <AuthCard title="Link expired" subtitle="Start again from Rankkw: open Connect Sellpify and click Connect.">
        <Link href="/" className="btn btn-md btn-dark w-full">Go to Sellpify</Link>
      </AuthCard>
    );
  }

  const user = await getCurrentUser();
  const here = `/connect/rankkw?${new URLSearchParams({ state, origin })}`;
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}`);

  const back = `${rankkwCallback(origin)}?${new URLSearchParams({ state, error: 'denied' })}`;
  if (user.role !== 'seller' || !user.storeName) {
    return (
      <AuthCard title="Open your shop first" subtitle="Rankkw adds listings to a Sellpify shop. Open yours, then connect again from Rankkw.">
        <div className="grid gap-2">
          <Link href="/sell-on-sellpify" className="btn btn-md btn-primary w-full">Open a Sellpify shop</Link>
          <a href={back} className="btn btn-md w-full text-stone-600 hover:bg-stone-100">Back to Rankkw</a>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Connect Rankkw" subtitle={`Rankkw will add listings to your shop ${user.storeName}.`}>
      <ul className="mb-6 grid gap-2 text-sm text-stone-600">
        <li>Create listings in {user.storeName} from your Etsy listings</li>
        <li>Upload their photos and the files buyers download</li>
      </ul>
      <RankkwConnectButtons state={state} origin={origin} cancelHref={back} email={user.email} />
    </AuthCard>
  );
}
