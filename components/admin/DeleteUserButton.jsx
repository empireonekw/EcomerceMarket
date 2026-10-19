'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import DeleteUsersDialog from '@/components/admin/DeleteUsersDialog';

/** "Delete account" for one user (detail page / table row) — opens the password-confirmed dialog. */
export default function DeleteUserButton({ id, name, role, redirectTo, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative z-10 inline-flex items-center gap-1.5 rounded-full font-medium text-red-600 transition-colors hover:bg-red-50 ${
          size === 'md' ? 'h-10 border border-red-200 px-4 text-sm' : 'h-8 px-3 text-sm'
        }`}
      >
        <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
        {size === 'md' ? 'Delete account' : 'Delete'}
        {size !== 'md' && <span className="sr-only"> {name}</span>}
      </button>
      <DeleteUsersDialog users={[{ id, name, role }]} open={open} onClose={() => setOpen(false)} redirectTo={redirectTo} />
    </>
  );
}
