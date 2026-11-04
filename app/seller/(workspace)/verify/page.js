import Link from 'next/link';
import { Clock, ShieldCheck } from 'lucide-react';
import IdentityVerification from '@/components/seller/IdentityVerification';
import { PageHeader } from '@/components/dashboard/ui';
import { requireSellerStore } from '@/lib/auth';
import { getVerificationState } from '@/lib/data/seller-verification';
import { uploadDriver } from '@/lib/uploads';

export const metadata = { title: 'Verify your identity', robots: { index: false } };

function Done({ icon: Icon, tone, title, text }) {
  return (
    <div className={`max-w-2xl rounded-2xl border bg-white p-8 text-center ${tone === 'ok' ? 'border-emerald-200' : 'border-amber-200'}`}>
      <span className={`mx-auto grid size-14 place-items-center rounded-full ${tone === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
        <Icon size={26} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-serif text-2xl text-ink">{title}</h2>
      <p className="mt-2 text-sm text-stone-600">{text}</p>
      <Link href="/seller/dashboard" className="btn btn-md btn-dark mt-6">
        Back to dashboard
      </Link>
    </div>
  );
}

/** Seller → Verify identity: ID card (both sides) and a live selfie, asked for after the first sale. */
export default async function SellerVerifyPage() {
  const seller = await requireSellerStore('/seller/verify');
  const state = await getVerificationState(seller.id);

  return (
    <>
      <PageHeader
        title="Verify your identity"
        description="A quick, one-time check that keeps buyers and sellers safe. We need it before we can pay you."
      />
      {state.status === 'verified' ? (
        <Done icon={ShieldCheck} tone="ok" title="You’re verified" text="Your identity is confirmed, and your shop shows the blue verified tick. Payouts are open." />
      ) : state.status === 'pending' ? (
        <Done icon={Clock} title="We’re checking it" text="Thanks! We usually check it within a day or two and message you in your inbox. Payouts open once it’s verified." />
      ) : (
        <IdentityVerification uploads={uploadDriver()} rejectedNote={state.status === 'rejected' ? state.note || 'The photos weren’t clear enough.' : null} />
      )}
    </>
  );
}
