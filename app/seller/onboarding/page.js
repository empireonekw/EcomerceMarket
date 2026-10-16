import { redirect } from 'next/navigation';
import AuthBackground from '@/components/auth/AuthBackground';
import Logo from '@/components/Logo';
import SignOutButton from '@/components/SignOutButton';
import SellerSteps from '@/components/seller/SellerSteps';
import ShopDetailsForm from '@/components/seller/ShopDetailsForm';
import { requireSeller } from '@/lib/auth';

export const metadata = { title: 'Set up your shop' };

/**
 * Shop setup (step 2 of 2). Every seller page sends sellers here until their shop has a name
 * (requireSellerStore), so an abandoned setup is picked up again on the next visit or login.
 */
export default async function SellerOnboardingPage() {
  const seller = await requireSeller('/seller/onboarding');
  if (seller.storeName) redirect('/seller/dashboard');

  return (
    <>
      <AuthBackground />
      <main id="main" className="relative flex min-h-dvh flex-col px-4 py-6 sm:px-8">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-3 text-sm text-stone-500">
            <span className="hidden truncate sm:inline">{seller.email}</span>
            <SignOutButton className="btn btn-sm btn-outline" />
          </div>
        </header>

        <div className="mx-auto my-auto w-full max-w-[34rem] py-10">
          <SellerSteps current={1} />
          <div className="mt-6 rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="headline text-3xl leading-tight">Set up your shop</h1>
            <p className="mt-1.5 text-sm text-stone-500">
              Welcome, {seller.name.split(' ')[0]}. This is how buyers will know you — you can change it any time.
            </p>
            <div className="mt-6">
              <ShopDetailsForm mode="setup" />
            </div>
          </div>
          <p className="mt-5 text-center text-sm text-stone-500">Next: your dashboard, where you’ll add products and payout details.</p>
        </div>
      </main>
    </>
  );
}
