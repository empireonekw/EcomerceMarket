import Link from 'next/link';
import { Download, ShieldCheck, Infinity as InfinityIcon } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: 'About Us',
  description: `${siteConfig.name} is a marketplace for templates, e-books, software and vector packs from independent creators.`,
};

const VALUES = [
  { icon: Download, title: 'Instant delivery', text: 'Every purchase is delivered the moment checkout completes — no waiting, no shipping.' },
  { icon: ShieldCheck, title: 'Secure by default', text: 'Files are only ever served through signed, expiring links tied to your order.' },
  { icon: InfinityIcon, title: 'Lifetime access', text: 'Your purchases live in your account. Re-download whenever you need them.' },
];

export default function AboutPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <PageIntro
        eyebrow="About us"
        title="Tools and resources for people who make things."
        description={`${siteConfig.name} is a curated marketplace for digital products — design templates, practical e-books, developer tools and vector packs — made by independent creators and delivered instantly.`}
      >
        <Link href="/products" className="btn btn-lg btn-primary">
          Browse products
        </Link>
        <Link href="/sell/signup" className="btn btn-lg btn-outline">
          Sell with us
        </Link>
      </PageIntro>

      <ul className="mt-16 grid gap-5 sm:mt-20 md:grid-cols-3">
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
    </div>
  );
}
