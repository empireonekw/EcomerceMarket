import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Store } from 'lucide-react';
import AuthBackground from '@/components/auth/AuthBackground';
import EmailVerification from '@/components/EmailVerification';
import Logo from '@/components/Logo';
import OnboardingWizard from '@/components/seller/onboarding/OnboardingWizard';
import { getCurrentUser } from '@/lib/auth';
import { getOnboarding } from '@/lib/data/seller-onboarding';
import { POLICIES } from '@/lib/policies';
import { ONBOARDING_PATH } from '@/lib/seller-onboarding';
import { uploadDriver } from '@/lib/uploads';

export const metadata = { title: 'Open your shop', robots: { index: false } };

function Gate({ title, text, children }) {
  return (
    <div className="mx-auto my-auto w-full max-w-md py-16 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700">
        <Store size={26} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-serif text-4xl tracking-tight text-ink">{title}</h1>
      <p className="mt-3 text-stone-600">{text}</p>
      <div className="mt-8 space-y-3">{children}</div>
    </div>
  );
}

/**
 * "Sell on Sellpify": the shop-opening wizard (components/seller/onboarding/OnboardingWizard.jsx). Any shopping
 * account can open a shop here (it keeps its purchases); signed-out visitors log in or create an account first.
 * Sellers whose shop is open go to their dashboard; admins can't open shops; everyone else verifies their email first.
 */
export default async function SellOnSellpifyPage() {
  const user = await getCurrentUser();
  if (user?.role === 'seller' && user.storeName) redirect('/seller/dashboard');

  let content;
  if (!user) {
    content = (
      <Gate
        title="Open your shop on Sellpify"
        text="Sell your digital products and handmade work to buyers everywhere. Log in or create a free account to start: it takes about five minutes."
      >
        <Link href={`/login?next=${encodeURIComponent(ONBOARDING_PATH)}`} className="btn btn-lg btn-dark w-full">
          Log in to continue
        </Link>
        <Link href="/sell/signup" className="btn btn-lg btn-outline w-full">
          Create an account
        </Link>
      </Gate>
    );
  } else if (user.role === 'admin') {
    content = (
      <Gate
        title="You’re signed in as an admin"
        text="Admin accounts manage the marketplace and can’t open a shop. Sign in with another account to sell."
      >
        <Link href="/admin" className="btn btn-lg btn-dark w-full">
          Go to the admin dashboard
        </Link>
      </Gate>
    );
  } else if (user.mustVerifyEmail) {
    content = (
      <div className="mx-auto my-auto w-full max-w-lg py-16">
        <EmailVerification email={user.email} title="First, verify your email" text="Buyers and Sellpify reach you by email about orders and payouts." />
      </div>
    );
  } else {
    content = (
      <OnboardingWizard
        initial={await getOnboarding(user.id)}
        uploads={uploadDriver()}
        agreement={POLICIES['seller-agreement']}
        firstName={user.name.split(' ')[0]}
      />
    );
  }

  return (
    <>
      <AuthBackground />
      <main id="main" className="relative flex min-h-dvh flex-col px-4 py-6 sm:px-8">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <Logo eager />
          {user && <span className="hidden truncate text-sm text-stone-500 sm:inline">{user.email}</span>}
        </header>
        <div className="mx-auto mt-8 flex w-full max-w-5xl flex-1 flex-col">{content}</div>
      </main>
    </>
  );
}
