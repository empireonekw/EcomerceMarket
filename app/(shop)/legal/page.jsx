import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { POLICIES } from '@/lib/policies';
import { siteConfig } from '@/lib/site';

export const metadata = {
  title: 'Legal Center',
  description: `Every policy that applies to buying and selling on ${siteConfig.name}, in one place.`,
  alternates: { canonical: '/legal' },
};

// Terms and Privacy live at their own top-level URLs; the rest under /legal/<slug>.
const DOCUMENTS = [
  { href: '/terms', title: 'Terms of Service', summary: 'The agreement for using the marketplace.' },
  { href: '/privacy', title: 'Privacy Policy', summary: 'What data we keep, why, and your rights.' },
  ...Object.entries(POLICIES).map(([slug, p]) => ({ href: `/legal/${slug}`, title: p.title, summary: p.summary })),
];

/** /legal — index of every policy page. */
export default function LegalCenterPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <PageIntro
        eyebrow="Legal"
        title="Legal Center"
        description={`Plain-language policies for buyers and sellers on ${siteConfig.name}. Questions? Email ${siteConfig.supportEmail}.`}
      />
      <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOCUMENTS.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="group flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-6 transition-[box-shadow,border-color] hover:border-transparent hover:shadow-lift"
            >
              <span className="font-serif text-xl tracking-tight text-gray-900">{d.title}</span>
              <span className="mt-1.5 text-sm leading-relaxed text-stone-500">{d.summary}</span>
              <span className="mt-auto flex items-center gap-1.5 pt-6 text-sm font-medium text-stone-700">
                Read
                <ArrowRight size={15} strokeWidth={1.75} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
