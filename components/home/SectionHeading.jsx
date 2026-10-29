import { Eyebrow } from '@/components/home/Editorial';
import Reveal from '@/components/Reveal';

/** Homepage section header: caps eyebrow, serif title, optional lead line, optional action on the right. Fades up into view. */
export default function SectionHeading({ id, eyebrow, title, description, children }) {
  return (
    <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
        <h2 id={id} className="font-serif text-[2.25rem] leading-[1.05] font-normal tracking-[-0.025em] text-ink text-balance sm:text-[3rem]">
          {title}
        </h2>
        {description && <p className="mt-3 max-w-xl text-lg text-stone-600">{description}</p>}
      </div>
      {children}
    </Reveal>
  );
}
