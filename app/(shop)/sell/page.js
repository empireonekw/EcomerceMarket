import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BadgePercent, ShieldCheck, Upload, Wallet } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import SwitchToSellerButton from '@/components/seller/SwitchToSellerButton';
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
 * /sell — the seller landing page:
 *  - signed out  → explain + "Create seller account" (/sell/signup) / log in
 *  - customer    → seller accounts are separate from shopping accounts: sign out to create one
 *  - seller      → straight to the workspace (shop setup first if it isn't finished)
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
              <p className="mt-2 text-sm text-stone-600">Create a free seller account, then name your shop — about two minutes in total.</p>
              <div className="mt-6 flex flex-col gap-2">
                <Link href="/sell/signup" className="btn btn-lg btn-primary">
                  Create seller account
                </Link>
                <Link href="/login" className="btn btn-lg btn-outline">
                  I already sell here — log in
                </Link>
              </div>
            </>
          )}

          {user?.role === 'customer' && (
            <>
              <h2 className="headline text-2xl">Selling needs a seller account</h2>
              <p className="mt-2 text-sm text-stone-600">
                You’re signed in as {user.email}, a shopping account. Seller accounts are separate, so your purchases
                and your shop never mix — create one with a different email.
              </p>
              <SwitchToSellerButton className="btn btn-lg btn-primary mt-6 w-full" />
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
