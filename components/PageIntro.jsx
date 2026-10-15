/** Pill label with an indigo dot: the eyebrow above page titles (same as the homepage hero). */
export function Eyebrow({ children, className = '' }) {
  return (
    <p className={`inline-flex items-center gap-2 rounded-full border border-stone-200 px-3.5 py-1.5 text-sm text-stone-600 ${className}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-600" />
      {children}
    </p>
  );
}

/** Storefront page intro: eyebrow, light headline, lead paragraph and optional actions. */
export default function PageIntro({ eyebrow, title, description, children, className = '' }) {
  return (
    <header className={`max-w-3xl ${className}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="headline mt-6 text-4xl leading-[1.08] text-balance sm:text-5xl lg:text-6xl">{title}</h1>
      {description && <p className="mt-5 text-lg leading-relaxed text-stone-600 text-pretty sm:text-xl">{description}</p>}
      {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
    </header>
  );
}
