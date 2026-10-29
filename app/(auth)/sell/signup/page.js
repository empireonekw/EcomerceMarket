import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgePercent, ShieldCheck, Wallet } from 'lucide-react';
import AuthCard from '@/components/auth/AuthCard';
import SignupForm from '@/components/auth/SignupForm';
import SellerSteps from '@/components/seller/SellerSteps';
import SwitchToSellerButton from '@/components/seller/SwitchToSellerButton';
import { getCurrentUser } from '@/lib/auth';
import { commissionPercent, COMMISSION_RATE, NO_PLATFORM_FEE } from '@/lib/commission';

export const metadata = { title: 'Create a seller account', robots: { index: false } };

const PERKS = [
  { icon: BadgePercent, label: NO_PLATFORM_FEE ? 'No platform fees, keep 100%' : `Keep ${commissionPercent(1 - COMMISSION_RATE)} of every sale` },
  { icon: ShieldCheck, label: 'Protected, instant delivery' },
  { icon: Wallet, label: 'Bank & wallet payouts' },
];

/** Signed-in shopping/admin accounts can't sell: explain in place (no redirect hop). */
function NotForThisAccount({ user }) {
  const isAdmin = user.role === 'admin';
  return (
    <AuthCard
      title={isAdmin ? 'You’re signed in as an admin' : 'Selling needs a seller account'}
      subtitle={
        isAdmin
          ? 'Admin accounts manage the marketplace and can’t open a store.'
          : `You’re signed in as ${user.email}, a shopping account. Seller accounts are separate, so your purchases and your shop never mix. Create one with a different email.`
      }
    >
      {isAdmin ? (
        <Link href="/admin/payouts" className="btn btn-lg btn-dark w-full">
          Go to seller payouts
        </Link>
      ) : (
        <div className="space-y-2">
          <SwitchToSellerButton className="btn btn-lg btn-primary w-full" />
          <Link href="/products" className="btn btn-lg btn-outline w-full">
            Keep shopping
          </Link>
        </div>
      )}
    </AuthCard>
  );
}

/**
 * Seller sign-up (step 1 of 2) — where every "Sell With Us" link points. Creates a seller account, then
 * continues on /login with the email prefilled; after logging in the seller names their shop at
 * /seller/onboarding (step 2). Sellers go straight to their workspace.
 */
export default async function SellerSignupPage() {
  const user = await getCurrentUser();
  if (user?.role === 'seller') redirect('/seller/dashboard');
  if (user) return <NotForThisAccount user={user} />;

  return (
    <AuthCard
      wide
      eyebrow={<SellerSteps current={0} />}
      title="Create your seller account"
      subtitle="Takes about a minute. You’ll name your shop right after you log in."
      footer={
        <div className="space-y-2">
          <p>
            Already selling?{' '}
            <Link href="/login" className="font-medium text-black hover:underline">
              Log in
            </Link>
          </p>
          <p className="text-stone-500">
            Here to shop instead?{' '}
            <Link href="/signup" className="font-medium text-black hover:underline">
              Create a shopping account
            </Link>
          </p>
        </div>
      }
    >
      <ul className="mb-6 flex flex-wrap gap-2">
        {PERKS.map(({ icon: Icon, label }) => (
          <li key={label} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
            <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
      <SignupForm accountType="seller" />
    </AuthCard>
  );
}
