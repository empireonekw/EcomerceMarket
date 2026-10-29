/** Homepage section header: small uppercase eyebrow, serif title, optional lead line, optional action on the right. */
export default function SectionHeading({ id, eyebrow, title, description, children }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-stone-500">{eyebrow}</p>}
        <h2 id={id} className="font-serif text-3xl font-normal tracking-tight text-gray-900 sm:text-5xl">
          {title}
        </h2>
        {description && <p className="mt-3 text-lg text-stone-600">{description}</p>}
      </div>
      {children}
    </div>
  );
}
