import { FileArchive, FileText, Figma, NotebookText, Palette, Shapes, Sheet } from 'lucide-react';

// The file types and tools sellers deliver in (uploads: PDF/ZIP; links: Canva, Notion, Figma, Google Sheets…).
const FORMATS = [
  { label: 'PDF', icon: FileText, className: 'font-serif text-2xl font-semibold' },
  { label: 'Canva', icon: Palette, className: 'font-serif text-2xl italic' },
  { label: 'Notion', icon: NotebookText, className: 'text-xl font-semibold tracking-tight' },
  { label: 'Figma', icon: Figma, className: 'text-xl font-medium' },
  { label: 'SVG', icon: Shapes, className: 'font-mono text-lg font-semibold tracking-widest' },
  { label: 'Google Sheets', icon: Sheet, className: 'text-lg font-medium' },
  { label: 'ZIP', icon: FileArchive, className: 'font-mono text-lg font-semibold tracking-widest' },
];

/**
 * Slim row under the hero: the formats you can buy, set like a row of partner logos (icon + name, all stone-400).
 * They drift left → right inside their own lane beside the heading, fading in and out at its edges.
 * Pure CSS: the list is rendered twice and the track runs marquee-x (globals.css) in reverse. Pauses on hover and
 * keyboard focus; under "reduce motion" it's a static, wrapping row.
 */
export default function FormatStrip() {
  return (
    <section aria-labelledby="formats-heading" className="border-b border-stone-200 bg-white">
      <div className="container-page flex flex-col items-center gap-6 py-10 lg:flex-row lg:gap-10">
        <h2 id="formats-heading" className="shrink-0 text-sm text-stone-500">
          Files and links for the tools you already use
        </h2>

        <div className="group/formats w-full min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)] motion-reduce:[mask-image:none]">
          <div
            className="flex w-max text-stone-400 motion-safe:animate-marquee-x group-hover/formats:[animation-play-state:paused]! group-focus-within/formats:[animation-play-state:paused]! motion-reduce:w-full"
            style={{ animationDuration: '32s', animationDirection: 'reverse' }}
          >
            {[0, 1].map((copy) => (
              // The second copy only closes the loop: hidden from assistive tech (and dropped when motion is reduced).
              <ul
                key={copy}
                aria-hidden={copy === 1 || undefined}
                className={`flex shrink-0 items-center motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-4 ${copy === 1 ? 'motion-reduce:hidden' : ''}`}
              >
                {FORMATS.map(({ label, icon: Icon, className }) => (
                  <li key={label} className={`flex shrink-0 items-center gap-2.5 px-6 sm:px-8 ${className}`}>
                    <Icon size={22} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
