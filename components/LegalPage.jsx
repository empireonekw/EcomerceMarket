import PageIntro from '@/components/PageIntro';

/**
 * Shared layout for legal pages. The content passed in is a factual summary of how the site works,
 * NOT legal advice — the site owner must replace it with reviewed Terms / Privacy text before launch.
 */
export default function LegalPage({ title, updated, sections }) {
  return (
    <div className="container-page max-w-3xl py-16 sm:py-24">
      <PageIntro eyebrow="Legal" title={title} description={`Last updated ${updated}`} />
      <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Summary version — the complete document will be published here.
      </p>
      <div className="mt-12 space-y-10">
        {sections.map((s) => (
          <section key={s.heading}>
            <h2 className="headline text-2xl">{s.heading}</h2>
            <p className="mt-3 leading-relaxed text-stone-600">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
