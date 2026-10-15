'use client';

import { useEffect } from 'react';

export default function AdminError({ error, retry }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div className="max-w-md">
        <p className="text-sm font-medium text-red-600">Something went wrong</p>
        <h1 className="mt-2 text-2xl headline">This admin page failed to load.</h1>
        <p className="mt-2 text-sm text-stone-500">
          Check the database connection and server logs.
          {error?.digest && <span className="mt-1 block text-xs text-stone-400">Reference: {error.digest}</span>}
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="btn btn-md btn-dark mt-6"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
