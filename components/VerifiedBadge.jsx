/**
 * Blue tick next to the name of a seller whose ID an admin has verified (Admin → Users → Verification). Works in
 * server and client components. `size` in px; `decorative` when the text next to it already says "verified".
 */
export default function VerifiedBadge({ size = 16, className = '', decorative = false }) {
  return (
    <span title="Verified seller" className={`inline-flex shrink-0 align-[-0.125em] ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size}>
        {/* A scalloped seal (like other marketplaces' verified marks) with a white check. */}
        <path
          fill="#1d9bf0"
          d="M22.5 12c0-1.6-.9-3-2.2-3.7.5-1.4.2-3.1-.9-4.2a4.2 4.2 0 0 0-4.2-.9C14.5 1.9 13.1 1 11.5 1s-3 .9-3.7 2.2c-1.4-.5-3.1-.2-4.2.9a4.2 4.2 0 0 0-.9 4.2C1.4 9 .5 10.4.5 12s.9 3 2.2 3.7c-.5 1.4-.2 3.1.9 4.2 1.1 1.1 2.8 1.4 4.2.9.7 1.3 2.1 2.2 3.7 2.2s3-.9 3.7-2.2c1.4.5 3.1.2 4.2-.9 1.1-1.1 1.4-2.8.9-4.2 1.3-.7 2.2-2.1 2.2-3.7Z"
        />
        <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="m7.5 12.2 2.8 2.8 5.7-6" />
      </svg>
      {!decorative && <span className="sr-only"> (verified seller)</span>}
    </span>
  );
}
