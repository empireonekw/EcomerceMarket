/** "No conversations to see here!" — two people talking in dashed speech bubbles. */
export default function EmptyInbox({ title = 'No conversations to see here!', children }) {
  return (
    <div className="flex flex-col items-center px-6 pb-16 pt-10 text-center">
      <svg
        aria-hidden="true"
        viewBox="0 0 320 210"
        className="h-40 w-auto text-stone-400 sm:h-48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Left: a person with long hair, facing right */}
        <path d="M46 138c-14-2-20-14-14-28 6-14 4-30 10-44 8-18 30-26 50-20 18 6 26 22 22 38" />
        <path d="M70 128c-6-8-8-20-4-32 4-14 16-22 30-22 12 0 20 8 20 18l6 4-6 4c2 10-2 20-12 24l2 10" />
        <circle cx="112" cy="84" r="1.6" fill="currentColor" stroke="none" />
        <path d="M58 140h66c6 0 10 4 10 9s-4 9-10 9H70c-14 0-22-8-22-18" />
        <path d="M84 140v18M98 140v18M112 140v18" />
        {/* Speech bubbles */}
        <path strokeDasharray="6 7" d="M146 72c8-14 26-14 34-26 8-12 26-16 36-4 10 12 4 30-12 32-14 2-22 10-36 8-8-1-14-4-22-10" />
        <path strokeDasharray="6 7" d="M140 132c-10-14-4-34 10-38 14-4 22 10 28 22 6 10 18 14 30 12-12 8-30 10-42 8-10-1-20-1-26-4" />
        {/* Right: a person with short hair, facing left */}
        <path d="M232 104c-6-4-8-14-2-22 8-10 26-12 40-6 14 6 18 22 12 34-4 8-4 16 0 22" />
        <path d="M232 104l-8 10 6 4-2 8c4 6 12 8 18 4l2 14" />
        <circle cx="236" cy="112" r="1.6" fill="currentColor" stroke="none" />
        <path d="M244 146l-14 10 12 12 14-12 14 12 18-14-16-10" />
        <path d="M268 144l4 14" />
      </svg>
      <p className="mt-6 text-lg font-semibold text-ink">{title}</p>
      {children}
    </div>
  );
}
