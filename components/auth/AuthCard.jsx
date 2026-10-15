import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/Logo';

/** Centered auth layout: logo + back link, card (title, subtitle, form), footer line. `wide` fits a two-column form. */
export default function AuthCard({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className={`w-full ${wide ? 'max-w-[38rem]' : 'max-w-[26rem]'}`}>
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-black">
            <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
            Back to store
          </Link>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-lift sm:p-8">
          <h1 className="headline text-[1.75rem] leading-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-stone-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center text-sm text-stone-600">{footer}</div>}
      </div>
    </div>
  );
}
