import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgePercent, ShieldCheck, Upload, Wallet } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import SellerProfileForm from '@/components/seller/SellerProfileForm';
import { getCurrentUser } from '@/lib/auth';
import { commissionPercent, COMMISSION_RATE } from '@/lib/commission';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: 'Sell With Us',
  description: `Sell templates, e-books, software and vector packs on ${siteConfig.name}.`,
};

const keepPercent = commissionPercent(1 - COMMISSION_RATE);
const PERKS = [
  { icon: Upload, title: 'List in minutes', text: 'Add a cover image and a PDF link — we handle checkout and delivery.' },
  { icon: BadgePercent, title: `Keep ${keepPercent}`, text: `A flat ${commissionPercent()} platform fee. No monthly charges.` },
  { icon: ShieldCheck, title: 'Protected delivery', text: 'Buyers get signed, expiring download links — never your raw file URL.' },
  { icon: Wallet, title: 'Local payouts', text: 'Withdraw to your bank account, EasyPaisa or JazzCash.' },
];

function Intro() {
  return (
    <PageIntro
      eyebrow="Sell with us"
      title="Turn your digital products into income."
      description={`Reach buyers looking for quality templates, e-books and tools. You keep ${keepPercent} of every sale.`}
    />
  );
}

function Perks() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {PERKS.map(({ icon: Icon, title, text }) => (
        <li key={title} className="rounded-2xl border border-stone-200 bg-white p-6">
          <span className="grid size-11 place-items-center rounded-xl bg-stone-100 text-black">
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="headline mt-5 text-xl">{title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{text}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * /sell — one URL, three states:
 *  - signed out  → explain + log in / sign up (returning here afterwards)
 *  - customer    → "Become a Seller" registration (store name + payout details)
 *  - seller      → straight to the seller dashboard
 */
export default async function SellPage() {
  const user = await getCurrentUser();
  if (user?.role === 'seller') redirect('/seller/dashboard');

  return (
    <div className="container-page py-16 sm:py-24">
      <Intro />

      <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_28rem] lg:items-start">
        <Perks />

        <aside className="rounded-2xl border border-stone-200 bg-white p-6 shadow-lift sm:p-8">
          {!user && (
            <>
              <h2 className="headline text-2xl">Start selling</h2>
              <p className="mt-2 text-sm text-stone-600">Log in or create a free account, then set up your store in one step.</p>
              <div className="mt-6 flex flex-col gap-2">
                <Link href="/signup?next=/sell" className="btn btn-lg btn-primary">
                  Create an account
                </Link>
                <Link href="/login?next=/sell" className="btn btn-lg btn-outline">
                  I already have an account
                </Link>
              </div>
            </>
          )}

          {user?.role === 'customer' && (
            <>
              <h2 className="headline text-2xl">Become a seller</h2>
              <p className="mt-2 text-sm text-stone-600">
                Signed in as {user.email}. Name your store and tell us where to send your earnings.
              </p>
              <div className="mt-6">
                <SellerProfileForm mode="register" />
              </div>
            </>
          )}

          {user?.role === 'admin' && (
            <>
              <h2 className="headline text-2xl">You’re signed in as an admin</h2>
              <p className="mt-2 text-sm text-stone-600">Admin accounts manage the marketplace and can’t open a store.</p>
              <Link href="/admin/payouts" className="btn btn-lg btn-dark mt-6 w-full">
                Go to seller payouts
              </Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
