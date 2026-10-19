'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Trash2, X } from 'lucide-react';
import DeleteUserButton from '@/components/admin/DeleteUserButton';
import DeleteUsersDialog from '@/components/admin/DeleteUsersDialog';
import { StatusBadge, RoleBadge, formatDateTime } from '@/components/dashboard/ui';
import { formatPrice } from '@/lib/utils';

const usd = (cents) => formatPrice(cents, 'USD');
const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
const lastActive = (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt).date : 'never');
const checkbox = 'relative z-10 size-4 cursor-pointer rounded border-stone-300 accent-brand-600';

/** Items purchased (paid orders with this email, guest checkouts included) and money spent. */
function Purchases({ p }) {
  if (!p.items) return <span className="text-stone-400">—</span>;
  return (
    <>
      <p className="font-medium tabular-nums">{plural(p.items, 'item')}</p>
      <p className="text-xs text-stone-500 tabular-nums">
        {usd(p.spent)} · {plural(p.orders, 'order')}
      </p>
    </>
  );
}

/** Products sold (one per sale line) and gross revenue; listings live / total underneath. */
function Selling({ s }) {
  if (!s) return <span className="text-stone-400">—</span>;
  return (
    <>
      <p className="font-medium tabular-nums">{plural(s.sales, 'product')} sold</p>
      <p className="text-xs text-stone-500 tabular-nums">
        {usd(s.gross)} · {s.live}/{s.products} live
      </p>
    </>
  );
}

function RowCheckbox({ u, selectable, checked, onToggle }) {
  if (!selectable) return <span className="block size-4" aria-hidden="true" />;
  return <input type="checkbox" checked={checked} onChange={() => onToggle(u.id)} aria-label={`Select ${u.name}`} className={checkbox} />;
}

function Actions({ u, selectable, isYou }) {
  if (!selectable) return <span className="text-xs text-stone-400">{isYou ? 'You' : 'Protected'}</span>;
  return <DeleteUserButton id={u.id} name={u.name} role={u.role} />;
}

/**
 * Admin → Users table with row checkboxes, "Select all" (this page's deletable accounts) and bulk delete.
 * Admin accounts — including yours — are never selectable (the API refuses them too).
 */
export default function UsersTable({ items, currentAdminId }) {
  const deletable = useMemo(() => items.filter((u) => u.role !== 'admin' && u.id !== currentAdminId), [items, currentAdminId]);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const headerRef = useRef(null);

  // Drop selections that are no longer on the page (after deleting, paging or filtering).
  useEffect(() => {
    setSelected((prev) => new Set([...prev].filter((id) => deletable.some((u) => u.id === id))));
  }, [deletable]);

  const allSelected = deletable.length > 0 && selected.size === deletable.length;
  useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = selected.size > 0 && !allSelected;
  }, [selected, allSelected]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(deletable.map((u) => u.id)));
  const canSelect = (u) => u.role !== 'admin' && u.id !== currentAdminId;
  const selectedUsers = deletable.filter((u) => selected.has(u.id)).map(({ id, name, role }) => ({ id, name, role }));

  return (
    <>
      {/* ---------- Bulk bar ---------- */}
      <div className="mb-3 flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-2">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-stone-700">
          <input ref={headerRef} type="checkbox" checked={allSelected} onChange={toggleAll} disabled={deletable.length === 0} className={checkbox} />
          {selected.size > 0 ? (
            <span>
              <span className="font-medium text-black">{selected.size}</span> selected
            </span>
          ) : (
            <span>Select all on this page</span>
          )}
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className="btn btn-sm text-stone-600 hover:bg-stone-100">
              <X size={14} strokeWidth={2} aria-hidden="true" />
              Clear
            </button>
            <button type="button" onClick={() => setBulkOpen(true)} className="btn btn-sm bg-red-600 text-white hover:bg-red-700">
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
              Delete selected
            </button>
          </div>
        )}
      </div>

      {/* ---------- Phones: cards ---------- */}
      <ul className="space-y-3 md:hidden">
        {items.map((u) => (
          <li
            key={u.id}
            className={`relative rounded-2xl border bg-white p-4 transition-shadow hover:shadow-lift ${selected.has(u.id) ? 'border-brand-500 ring-1 ring-brand-500' : 'border-stone-200'}`}
          >
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <RowCheckbox u={u} selectable={canSelect(u)} checked={selected.has(u.id)} onToggle={toggle} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${u.id}`} className="block truncate font-medium after:absolute after:inset-0 after:rounded-2xl">
                      {u.name}
                    </Link>
                    <p className="truncate text-sm text-stone-500">{u.selling?.storeName ?? u.email}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {u.selling ? `${plural(u.selling.sales, 'product')} sold` : `${plural(u.purchases.items, 'item')} purchased`} · Joined{' '}
                  {formatDateTime(u.createdAt).date}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
                  <StatusBadge status={u.status.tone} label={u.status.label} />
                  <Actions u={u} selectable={canSelect(u)} isYou={u.id === currentAdminId} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* ---------- Desktop: table ---------- */}
      <div className="hidden overflow-hidden rounded-2xl border border-stone-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="w-10 py-3 pl-4">
                  <span className="sr-only">Select</span>
                </th>
                <th scope="col" className="px-4 py-3">User</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Purchases</th>
                <th scope="col" className="px-4 py-3 text-right">Selling</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((u) => (
                <tr key={u.id} className={`relative transition-colors ${selected.has(u.id) ? 'bg-brand-50/60' : 'hover:bg-stone-50/70'}`}>
                  <td className="py-3.5 pl-4">
                    <RowCheckbox u={u} selectable={canSelect(u)} checked={selected.has(u.id)} onToggle={toggle} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-medium text-stone-700">
                        {u.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        {/* Stretched link: the whole row opens the user (checkbox and actions sit above it). */}
                        <Link href={`/admin/users/${u.id}`} className="block max-w-[13rem] truncate font-medium after:absolute after:inset-0 hover:underline">
                          {u.name}
                        </Link>
                        <p className="max-w-[13rem] truncate text-xs text-stone-500">{u.email}</p>
                        {u.selling?.storeName && <p className="max-w-[13rem] truncate text-xs text-brand-700">{u.selling.storeName}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={u.status.tone} label={u.status.label} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <Purchases p={u.purchases} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <Selling s={u.selling} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-stone-600">
                    {formatDateTime(u.createdAt).date}
                    <span className="block text-xs text-stone-400">Active {lastActive(u)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Actions u={u} selectable={canSelect(u)} isYou={u.id === currentAdminId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteUsersDialog
        users={selectedUsers}
        open={bulkOpen && selectedUsers.length > 0}
        onClose={() => setBulkOpen(false)}
        onDeleted={(ids) => setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))))}
      />
    </>
  );
}
