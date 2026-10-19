'use client';

import { useLinkStatus } from 'next/link';

const spinner = 'inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent';

/**
 * Instant feedback for a <Link> while its page loads (must be rendered INSIDE the Link).
 *  - default: a small spinner after the label
 *  - `replace`: swaps the label for the spinner, keeping the width (page-number buttons)
 */
export default function LinkPending({ children, replace = false }) {
  const { pending } = useLinkStatus();
  if (replace) {
    return (
      <span className="relative inline-grid place-items-center">
        <span className={pending ? 'invisible' : undefined}>{children}</span>
        {pending && <span aria-hidden="true" className={`absolute ${spinner}`} />}
      </span>
    );
  }
  return (
    <>
      {children}
      {pending && <span aria-hidden="true" className={`ml-auto ${spinner} opacity-60`} />}
    </>
  );
}
