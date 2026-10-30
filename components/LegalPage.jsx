import Link from 'next/link';
import { Mail } from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import { siteConfig, gmailCompose } from '@/lib/site';

/** A body block: a string is a paragraph, an array of strings is a bullet list, anything else renders as-is. */
function Block({ children }) {
  if (typeof children === 'string') return <p>{children}</p>;
  if (Array.isArray(children)) {
    return (
      <ul className="list-disc space-y-2 pl-5 marker:text-stone-400">
        {children.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }
  return children;
}

/**
 * Shared layout for the legal and policy pages (Terms, Privacy, /legal/*, How It Works): numbered sections with a contents list,
 * then a support box. `sections` = [{ id, heading, body: Block[] }].
 */
export default function LegalPage({ title, updated, intro, sections, eyebrow = 'Legal' }) {
  return (
    <div className="container-page max-w-3xl py-16 sm:py-24">
      <PageIntro eyebrow={eyebrow} title={title} description={`Last updated ${updated}`} />
      {intro && <p className="mt-8 text-lg leading-relaxed text-stone-700">{intro}</p>}

      <nav aria-label="Contents" className="mt-10 rounded-2xl border border-stone-200 bg-stone-50 p-6">
        <p className="text-sm font-medium text-black">Contents</p>
        <ol className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-stone-600 transition-colors hover:text-black hover:underline hover:underline-offset-4">
                <span className="tabular-nums text-stone-400">{i + 1}.</span> {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 space-y-12">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`} className="scroll-mt-28">
            <h2 id={`${s.id}-heading`} className="headline text-2xl sm:text-[1.75rem]">
              <span className="tabular-nums text-stone-400">{i + 1}.</span> {s.heading}
            </h2>
            <div className="mt-4 space-y-4 leading-relaxed text-stone-600">
              {s.body.map((block, j) => (
                <Block key={j}>{block}</Block>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="mt-16 flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
            <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium">Questions about this page?</p>
            <p className="mt-0.5 text-sm text-stone-600">
              Email{' '}
              <a {...gmailCompose(siteConfig.supportEmail)} className="font-medium text-brand-700 hover:underline">
                {siteConfig.supportEmail}
              </a>
              . We reply within 1–2 business days.
            </p>
          </div>
        </div>
        <Link href="/contact" className="btn btn-md btn-outline shrink-0">
          Contact us
        </Link>
      </aside>
    </div>
  );
}
