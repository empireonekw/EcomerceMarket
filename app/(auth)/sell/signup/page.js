import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgePercent, ShieldCheck, Wallet } from 'lucide-react';
import Logo from '@/components/Logo';
import SignupForm from '@/components/auth/SignupForm';
import SellerSteps from '@/components/seller/SellerSteps';
import { getCurrentUser } from '@/lib/auth';
import { commissionPercent, splitSale, COMMISSION_RATE } from '@/lib/commission';
import { formatPrice } from '@/lib/utils';
import { siteConfig } from '@/lib/site';

export const metadata = { title: 'Create a seller account', robots: { index: false } };

const keep = commissionPercent(1 - COMMISSION_RATE);
const EXAMPLE_PRICE = 4000; // $40.00 — illustrates the split with the live commission rate
const example = splitSale(EXAMPLE_PRICE);

const PERKS = [
  { icon: BadgePercent, title: `Keep ${keep} of every sale`, text: `One flat ${commissionPercent()} fee. No listing or monthly charges.` },
  { icon: ShieldCheck, title: 'Protected, instant delivery', text: 'Buyers get signed download links — never your raw file URL.' },
  { icon: Wallet, title: 'Payouts to bank or wallet', text: 'Withdraw to a bank account, EasyPaisa or JazzCash.' },
];

/**
 * Seller sign-up (step 1 of 2). Creates a seller account, then continues on /login with the email
 * prefilled; after logging in the seller names their shop at /seller/onboarding (step 2).
 */
export default async function SellerSignupPage() {
  const user = await getCurrentUser();
  if (user?.role === 'seller') redirect('/seller/dashboard');
  if (user) redirect('/sell'); // shopping/admin accounts: /sell explains that seller accounts are separate

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* ---------- Brand panel (desktop) ---------- */}
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between bg-stone-950 p-10 text-white lg:flex xl:p-14">
        <Logo tone="light" />

        <div className="max-w-md">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-white/70">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-500" />
            For creators
          </p>
          <h2 className="headline mt-6 text-5xl leading-[1.05] text-balance">Sell your digital products to buyers everywhere.</h2>
          <ul className="mt-10 space-y-6">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10">
                  <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-0.5 text-sm text-white/60">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-white/60">Example: a {formatPrice(EXAMPLE_PRICE, 'USD')} sale</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="headline text-4xl tabular-nums">{formatPrice(example.sellerEarning, 'USD')}</p>
              <p className="mt-1 text-sm text-white/60">goes to you</p>
            </div>
            <p className="text-right text-sm text-white/60 tabular-nums">
              {formatPrice(example.commission, 'USD')} platform fee
              <span className="block">({commissionPercent()})</span>
            </p>
          </div>
        </div>
      </aside>

      {/* ---------- Form ---------- */}
      <div className="flex flex-col bg-white px-4 py-6 sm:px-10 lg:px-16 lg:py-10">
        <div className="flex items-center justify-between gap-4">
          <span className="lg:invisible">
            <Logo />
          </span>
          <p className="text-sm text-stone-500">
            Already selling?{' '}
            <Link href="/login" className="font-medium text-black hover:underline">
              Log in
            </Link>
          </p>
        </div>

        <div className="mx-auto my-auto w-full max-w-[36rem] py-10">
          <SellerSteps current={0} />
          <h1 className="headline mt-8 text-4xl leading-tight">Create your seller account</h1>
          <p className="mt-2 text-stone-500">Takes about a minute. You’ll name your shop right after you log in.</p>

          {/* Phones/tablets: the perks, condensed (the brand panel is desktop-only). */}
          <ul className="mt-6 flex flex-wrap gap-2 lg:hidden">
            {[`Keep ${keep}`, 'Instant delivery', 'Bank & wallet payouts'].map((t) => (
              <li key={t} className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
                {t}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <SignupForm accountType="seller" />
          </div>

          <p className="mt-8 border-t border-stone-200 pt-6 text-sm text-stone-500">
            Here to shop instead?{' '}
            <Link href="/signup" className="font-medium text-black hover:underline">
              Create a shopping account
            </Link>
          </p>
        </div>

        <p className="text-xs text-stone-400">
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
      </div>
    </div>
  );
}
