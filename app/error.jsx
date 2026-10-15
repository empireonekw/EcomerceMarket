'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, retry }) {
  useEffect(() => {
    // Hook up an error reporting service (Sentry, etc.) here.
    console.error(error);
  }, [error]);

  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <p className="text-sm font-medium text-brand-600">Something went wrong</p>
        <h1 className="mt-2 text-3xl headline">We couldn’t load this page.</h1>
        <p className="mt-3 text-stone-600">
          This is usually temporary. Try again, or head back to the storefront.
          {error?.digest && <span className="mt-2 block text-xs text-stone-400">Reference: {error.digest}</span>}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="btn btn-md btn-dark"
          >
            Try again
          </button>
          <Link href="/" className="btn btn-md btn-outline">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
