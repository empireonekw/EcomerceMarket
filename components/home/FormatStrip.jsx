// The file types and tools sellers deliver in (uploads: PDF/ZIP; links: Canva, Notion, Figma, Google Sheets…).
const FORMATS = [
  { label: 'PDF', className: 'font-serif text-2xl font-semibold' },
  { label: 'Canva', className: 'font-serif text-2xl italic' },
  { label: 'Notion', className: 'text-xl font-semibold tracking-tight' },
  { label: 'Figma', className: 'text-xl font-medium' },
  { label: 'SVG', className: 'font-mono text-lg font-semibold tracking-widest' },
  { label: 'Google Sheets', className: 'text-lg font-medium' },
  { label: 'ZIP', className: 'font-mono text-lg font-semibold tracking-widest' },
];

/** Slim row under the hero: the formats you can buy, set like a row of partner logos. */
export default function FormatStrip() {
  return (
    <section aria-labelledby="formats-heading" className="border-b border-stone-200 bg-white">
      <div className="container-page flex flex-col items-center gap-6 py-10 lg:flex-row lg:justify-between lg:gap-10">
        <h2 id="formats-heading" className="shrink-0 text-sm text-stone-500">
          Files and links for the tools you already use
        </h2>
        <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-stone-400">
          {FORMATS.map((f) => (
            <li key={f.label} className={f.className}>
              {f.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
