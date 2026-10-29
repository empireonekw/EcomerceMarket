import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { NO_PLATFORM_FEE } from '@/lib/commission';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: 'Help & FAQ',
  description: `Answers to common questions about buying, downloading, refunds and selling on ${siteConfig.name}.`,
  alternates: { canonical: '/help' },
};

const { supportEmail } = siteConfig;

const GROUPS = [
  {
    title: 'Buying',
    items: [
      { q: 'How do I get my files after paying?', a: 'Digital products are ready to download the moment payment clears — from the order confirmation page and any time later from your account.' },
      { q: 'Can I download again later?', a: 'Yes. Every purchase stays in your account for lifetime re-downloads, even if the seller later removes the product.' },
      { q: 'Can I ask the seller a question first?', a: 'Yes — open any product and tap “Message seller”. Replies arrive live in your Messages.' },
      { q: 'Is checkout secure?', a: 'Payments are processed by our payment provider over an encrypted connection. We never see or store your full card number.' },
    ],
  },
  {
    title: 'Refunds & licences',
    items: [
      { q: 'Can I get a refund?', a: 'If a file is faulty, not as described, or you were charged twice, contact us within 14 days of purchase and we will make it right.', href: '/legal/refund-policy', link: 'Refund Policy' },
      { q: 'What am I allowed to do with a product?', a: 'Use it in your own and client projects; don’t resell or share the original files.', href: '/legal/licensing', link: 'Licensing' },
    ],
  },
  {
    title: 'Selling',
    items: [
      { q: 'How do I start selling?', a: 'Create a seller account, add your first listing and submit it for review. Approved listings go live in their category.', href: '/sell/signup', link: 'Start selling' },
      { q: 'What does it cost?', a: NO_PLATFORM_FEE ? 'Opening a shop is free and we don’t take a commission — you keep every sale.' : 'Opening a shop is free; a small commission is taken from each sale.' },
      { q: 'How are listings reviewed?', a: 'A person checks rights, accuracy, files and category before a listing goes live.', href: '/how-it-works#review-methodology', link: 'Our review methodology' },
      { q: 'How do I get paid?', a: 'Add your bank account or mobile wallet on the Payouts page of your seller dashboard.', href: '/legal/seller-agreement', link: 'Seller Agreement' },
    ],
  },
  {
    title: 'Account',
    items: [
      { q: 'How do I change my password?', a: 'Open your profile and use the password form.' },
      { q: 'How do I delete my account?', a: 'Open your profile and choose “Delete account permanently”. Order records required by law are kept, unlinked from you.', href: '/privacy', link: 'Privacy Policy' },
    ],
  },
];

/** /help — FAQ (native <details>, no JS) with FAQPage structured data. */
export default function HelpPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: GROUPS.flatMap((g) => g.items).map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };

  return (
    <div className="container-page max-w-3xl py-16 sm:py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <PageIntro eyebrow="Help" title="Help & FAQ" description="Quick answers to the questions we hear most." />

      <div className="mt-12 space-y-12">
        {GROUPS.map((group) => (
          <section key={group.title} aria-labelledby={`faq-${group.title}`}>
            <h2 id={`faq-${group.title}`} className="font-serif text-2xl tracking-tight text-gray-900">
              {group.title}
            </h2>
            <div className="mt-4 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
              {group.items.map((item) => (
                <details key={item.q} className="group px-5 py-4 sm:px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-stone-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 leading-relaxed text-stone-600">
                    {item.a}{' '}
                    {item.href && (
                      <Link href={item.href} className="font-medium text-gray-900 underline underline-offset-4 hover:text-black">
                        {item.link}
                      </Link>
                    )}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="mt-16 rounded-2xl bg-brand-50 p-6 sm:p-8">
        <p className="font-serif text-2xl tracking-tight text-gray-900">Still need help?</p>
        <p className="mt-2 text-stone-600">
          Email{' '}
          <a href={`mailto:${supportEmail}`} className="font-medium text-gray-900 underline underline-offset-4">
            {supportEmail}
          </a>{' '}
          or send us a message — we reply within 1–2 business days.
        </p>
        <Link href="/contact" className="btn btn-md btn-dark mt-5">
          Contact us
        </Link>
      </aside>
    </div>
  );
}
