/** Homepage section header: large light title, optional lead line, optional action on the right. */
export default function SectionHeading({ id, title, description, children }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id={id} className="headline text-3xl sm:text-5xl">
          {title}
        </h2>
        {description && <p className="mt-3 text-lg text-stone-600">{description}</p>}
      </div>
      {children}
    </div>
  );
}
