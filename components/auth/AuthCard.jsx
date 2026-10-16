import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';

/**
 * Centered auth layout: logo + back link, card (optional eyebrow, title, subtitle, form), footer line.
 * `wide` fits the two-column sign-up forms; everything else uses the compact max-w-md card.
 */
export default function AuthCard({ title, subtitle, eyebrow, children, footer, wide = false }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-12">
      <div className={`w-full ${wide ? 'max-w-[38rem]' : 'max-w-md'}`}>
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-black">
            <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
            Back to store
          </Link>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          {eyebrow && <div className="mb-6">{eyebrow}</div>}
          <h1 className="headline text-[1.75rem] leading-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-stone-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center text-sm text-stone-600">{footer}</div>}
      </div>
    </div>
  );
}
