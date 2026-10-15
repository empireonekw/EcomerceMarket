import { siteConfig } from '@/lib/site';

/**
 * Full-screen "Signing you out…" state shown while the session is cleared and the browser
 * navigates to the homepage. Fades in, blocks clicks, and announces itself to screen readers.
 */
export default function SignOutScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] grid place-items-center bg-white/85 backdrop-blur-sm transition-opacity duration-300 starting:opacity-0"
    >
      <div className="flex flex-col items-center text-center">
        <span aria-hidden="true" className="size-9 animate-spin rounded-full border-2 border-stone-200 border-t-brand-600" />
        <p className="headline mt-6 text-2xl">Signing you out…</p>
        <p className="mt-1.5 text-sm text-stone-500">Thanks for visiting {siteConfig.name}.</p>
      </div>
    </div>
  );
}
