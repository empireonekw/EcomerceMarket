// Quiet backdrop for the auth pages (purely visual: aria-hidden, no pointer events).
// A faint dot grid plus two soft, slowly drifting colour fields — solid blurred shapes, no CSS gradients.
export default function AuthBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-stone-50">
      <svg className="absolute inset-0 h-full w-full text-stone-300/60">
        <defs>
          <pattern id="auth-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-dots)" />
      </svg>
      <div className="absolute -left-40 -top-40 size-[32rem] animate-drift rounded-full bg-brand-500/15 blur-3xl" />
      <div className="absolute -bottom-48 -right-32 size-[34rem] animate-drift rounded-full bg-brand-500/10 blur-3xl [animation-delay:-11s]" />
    </div>
  );
}
