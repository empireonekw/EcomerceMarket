import Link from 'next/link';
import { Building2, Download, Mail, ShieldCheck, Infinity as InfinityIcon } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { commissionPercent, COMMISSION_RATE, NO_PLATFORM_FEE } from '@/lib/commission';
import { siteConfig, gmailCompose } from '@/lib/site';

const sellerShare = commissionPercent(1 - COMMISSION_RATE);

export const metadata = {
  title: 'About Us',
  description: `${siteConfig.name} is a marketplace for templates, e-books, software and vector packs from independent creators.`,
};

const VALUES = [
  { icon: Download, title: 'Instant delivery', text: 'Every purchase is delivered the moment checkout completes, no waiting, no shipping.' },
  { icon: ShieldCheck, title: 'Secure by default', text: 'Files are only ever served through signed, expiring links tied to your order.' },
  { icon: InfinityIcon, title: 'Lifetime access', text: 'Your purchases live in your account. Re-download whenever you need them.' },
];

export default function AboutPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <PageIntro
        eyebrow="About us"
        title="Tools and resources for people who make things."
        description={`${siteConfig.name} is a curated marketplace for digital products, design templates, practical e-books, developer tools and vector packs, made by independent creators and delivered instantly.`}
      >
        <Link href="/products" className="btn btn-lg btn-primary">
          Browse products
        </Link>
        <Link href="/sell/signup" className="btn btn-lg btn-outline">
          Sell with us
        </Link>
      </PageIntro>

      <ul className="mt-16 grid grid-cols-1 gap-5 sm:mt-20 md:grid-cols-3">
        {VALUES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-2xl border border-stone-200 bg-white p-7">
            <span className="grid size-11 place-items-center rounded-xl bg-stone-100 text-black">
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h2 className="headline mt-6 text-2xl">{title}</h2>
            <p className="mt-2 leading-relaxed text-stone-600">{text}</p>
          </li>
        ))}
      </ul>

      {/* ---------- Who runs the platform ---------- */}
      <section aria-labelledby="who-heading" className="mt-16 grid grid-cols-1 gap-8 border-t border-stone-200 pt-16 sm:mt-20 sm:pt-20 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <h2 id="who-heading" className="headline text-3xl leading-tight sm:text-4xl">
            Who runs {siteConfig.name}
          </h2>
        </div>
        <div className="space-y-5 text-lg leading-relaxed text-stone-600 lg:col-span-7">
          <p>
            {siteConfig.name} is owned and operated by <span className="font-medium text-black">{siteConfig.operator}</span>. We run the marketplace itself: the
            storefront, secure checkout, instant delivery, customer support and seller payouts.
          </p>
          <p>
            The products are made by independent creators, who own their work and set their own prices. We review every product before it goes live, sell it on
            the creator’s behalf, and {NO_PLATFORM_FEE ? 'charge no platform fees, creators keep 100% of every sale' : `pay them ${sellerShare} of every sale`}. Every purchase comes with lifetime re-downloads and a clear{' '}
            <Link href="/terms#refunds" className="text-black underline underline-offset-4 hover:text-brand-700">
              refund policy
            </Link>
            .
          </p>

          <dl className="grid gap-4 pt-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-5">
              <Building2 size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700" />
              <div>
                <dt className="text-sm text-stone-500">Operated by</dt>
                <dd className="mt-0.5 text-base font-medium text-black">{siteConfig.operator}</dd>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-5">
              <Mail size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700" />
              <div className="min-w-0">
                <dt className="text-sm text-stone-500">Support</dt>
                <dd className="mt-0.5 text-base font-medium">
                  <a {...gmailCompose(siteConfig.supportEmail)} className="break-all text-black hover:text-brand-700 hover:underline">
                    {siteConfig.supportEmail}
                  </a>
                </dd>
              </div>
            </div>
          </dl>
          <p className="text-base">
            Questions or feedback? Visit our{' '}
            <Link href="/contact" className="text-black underline underline-offset-4 hover:text-brand-700">
              Contact page
            </Link>
            . A real person reads every message.
          </p>
        </div>
      </section>
    </div>
  );
}
