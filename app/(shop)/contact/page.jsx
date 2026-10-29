import Link from 'next/link';
import { Clock, Mail, Receipt, Store } from 'lucide-react';
import ContactForm from '@/components/ContactForm';
import PageIntro from '@/components/PageIntro';
import { getCurrentUser } from '@/lib/auth';
import { siteConfig, gmailCompose } from '@/lib/site';

export const metadata = {
  title: 'Contact Us',
  description: `Questions about an order, a download or selling on ${siteConfig.name}? Send us a message or email ${siteConfig.supportEmail}.`,
};

const HELP = [
  { icon: Receipt, title: 'Orders & downloads', text: 'Every purchase lives in your account and can be re-downloaded any time.', href: '/profile?tab=downloads', cta: 'My purchases' },
  { icon: Store, title: 'Selling with us', text: 'Open a shop, list products and get paid out to your bank or wallet.', href: '/sell/signup', cta: 'Start selling' },
];

export default async function ContactPage() {
  const user = await getCurrentUser();

  return (
    <div className="container-page py-16 sm:py-24">
      <PageIntro
        eyebrow="Contact"
        title="We’re here to help."
        description="Questions about an order, a download, a refund or selling on the marketplace, send us a message and a real person will get back to you."
      />

      <div className="mt-12 grid gap-8 sm:mt-16 lg:grid-cols-12 lg:gap-10">
        {/* ---------- Support details ---------- */}
        <aside className="space-y-5 lg:col-span-5">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-7">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Mail size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h2 className="headline mt-5 text-2xl">Email support</h2>
            <p className="mt-1.5 text-sm text-stone-600">Prefer email? Write to us directly.</p>
            <a {...gmailCompose(siteConfig.supportEmail)} className="mt-4 inline-block break-all text-lg font-medium text-brand-700 hover:underline hover:underline-offset-4">
              {siteConfig.supportEmail}
            </a>
            <p className="mt-5 flex items-center gap-2 border-t border-stone-100 pt-5 text-sm text-stone-600">
              <Clock size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-stone-400" />
              We reply within 1–2 business days.
            </p>
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            {HELP.map(({ icon: Icon, title, text, href, cta }) => (
              <li key={title} className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-100 text-black">
                  <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{text}</p>
                  <Link href={href} className="mt-2 inline-block text-sm font-medium text-black underline-offset-4 hover:underline">
                    {cta} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* ---------- Form ---------- */}
        <section aria-labelledby="contact-form-heading" className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 lg:col-span-7">
          <h2 id="contact-form-heading" className="headline text-3xl">
            Send a message
          </h2>
          <p className="mt-1.5 text-sm text-stone-500">
            All fields are required. See our{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-black">
              Privacy Policy
            </Link>{' '}
            for how we handle your details.
          </p>
          <div className="mt-6">
            <ContactForm defaultName={user?.name ?? ''} defaultEmail={user?.email ?? ''} />
          </div>
        </section>
      </div>
    </div>
  );
}
