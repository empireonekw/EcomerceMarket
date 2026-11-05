'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PartyPopper, ShieldCheck } from 'lucide-react';

const DISMISSED_KEY = 'sellpify:verify-prompt-dismissed';

/**
 * Pop-up after the seller's first sale (seller.verificationRequestedAt): verify your identity to get paid. Shown once
 * per browser session on any seller page except /seller/verify itself; "Later" hides it until the next visit.
 */
export default function VerifyIdentityPrompt() {
  const dialogRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/seller/verify')) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISSED_KEY) === '1';
    } catch {}
    if (!dismissed && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [pathname]);

  function later() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {}
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="verify-prompt-title"
      onCancel={later}
      onClick={(e) => e.target === e.currentTarget && later()}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-3xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
    >
      <div className="p-6 sm:p-7">
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
          <PartyPopper size={22} strokeWidth={1.75} />
        </span>
        <h2 id="verify-prompt-title" className="mt-5 text-xl font-semibold tracking-[-0.01em]">
          You made your first sale!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Before we can send your earnings, please verify your identity: a photo of both sides of your ID card and a quick selfie. It takes about two
          minutes, and a blue tick appears next to your shop’s name once it’s verified.
        </p>
        <p className="mt-3 flex items-center gap-2 text-xs text-stone-500">
          <ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true" />
          Your ID is only seen by our team and never shown to buyers.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-stone-100 bg-stone-50/60 px-6 py-4 sm:flex sm:justify-end sm:px-7">
        <button type="button" onClick={later} className="h-10 rounded-full border border-stone-300 bg-white px-5 text-sm font-medium hover:border-ink">
          Later
        </button>
        <Link href="/seller/verify" onClick={() => dialogRef.current?.close()} className="btn btn-md btn-dark h-10">
          Verify identity
        </Link>
      </div>
    </dialog>
  );
}
