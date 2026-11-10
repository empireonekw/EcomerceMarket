'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Trash2, X } from 'lucide-react';
import DeleteUserButton from '@/components/admin/DeleteUserButton';
import DeleteUsersDialog from '@/components/admin/DeleteUsersDialog';
import { BlockUserButton, RoleSelect } from '@/components/admin/UserAccessControls';
import { StatusBadge, formatDateTime } from '@/components/dashboard/ui';
import { Avatar, TABLE_HEAD } from '@/components/admin/ui';
import { formatPrice } from '@/lib/utils';
import VerifiedBadge from '@/components/VerifiedBadge';

const usd = (cents) => formatPrice(cents, 'USD');
const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
const lastActive = (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt).date : 'never');
const checkbox = 'relative z-10 size-4 cursor-pointer rounded border-stone-300 accent-brand-600';

/** Items purchased (paid orders with this email, guest checkouts included) and money spent. */
function Purchases({ p }) {
  if (!p.items) return <span className="text-stone-400">–</span>;
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
  if (!s) return <span className="text-stone-400">–</span>;
  return (
    <>
      <p className="font-medium tabular-nums">{plural(s.sales, 'product')} sold</p>
      <p className="text-xs text-stone-500 tabular-nums">
        {usd(s.gross)} · {s.live}/{s.products} live
      </p>
    </>
  );
}

/** The seller's ID check, when there is one: to review (amber), rejected (red). Verified shows as the blue tick. */
function IdChip({ v }) {
  if (v === 'pending')
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-600/20 ring-inset">
        ID to review
      </span>
    );
  if (v === 'rejected')
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20 ring-inset">ID rejected</span>;
  return null;
}

function RowCheckbox({ u, selectable, checked, onToggle }) {
  if (!selectable) return <span className="block size-4" aria-hidden="true" />;
  return <input type="checkbox" checked={checked} onChange={() => onToggle(u.id)} aria-label={`Select ${u.name}`} className={checkbox} />;
}

/** Block first, Delete as the stronger option. Admins (change their role first), you and the owner have neither. */
function Actions({ u, selectable, isYou }) {
  if (!selectable) return <span className="text-xs text-stone-400">{isYou ? 'You' : u.isOwner ? 'Owner' : 'Admin'}</span>;
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {/* Icons with tooltips; the words come back on very wide screens. */}
      <BlockUserButton user={u} labelClassName="hidden 2xl:inline" />
      <DeleteUserButton id={u.id} name={u.name} role={u.role} labelClassName="hidden 2xl:inline" />
    </span>
  );
}

/**
 * Admin → Users table with row checkboxes, "Select all" (this page's deletable accounts) and bulk delete, a role
 * dropdown per row and Block / Delete actions. Admin accounts — including yours — are never selectable or blockable
 * (the API refuses them too); your own role and the owner's are locked.
 */
export default function UsersTable({ items, currentAdminId, summary }) {
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
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {/* ---------- Bulk bar (the card's header) ---------- */}
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
          <label className="flex cursor-pointer items-center gap-3 text-sm text-stone-600">
            <input
              ref={headerRef}
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              disabled={deletable.length === 0}
              className={checkbox}
            />
            {selected.size > 0 ? (
              <span>
                <span className="font-semibold text-ink">{selected.size}</span> selected
              </span>
            ) : (
              <span>Select all on this page</span>
            )}
          </label>
          {selected.size > 0 ? (
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
          ) : (
            summary && <span className="text-xs text-stone-500">{summary}</span>
          )}
        </div>

        {/* ---------- Phones: rows ---------- */}
        <ul className="divide-y divide-stone-100 border-t border-stone-100 md:hidden">
          {items.map((u) => (
            <li key={u.id} className={`relative px-4 py-3.5 ${selected.has(u.id) ? 'bg-brand-50/60' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="pt-2.5">
                  <RowCheckbox u={u} selectable={canSelect(u)} checked={selected.has(u.id)} onToggle={toggle} />
                </div>
                <Avatar name={u.name} tone={u.role === 'seller' ? 'brand' : 'stone'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/admin/users/${u.id}`} className="block truncate text-sm font-semibold text-ink after:absolute after:inset-0">
                        {u.name}
                      </Link>
                      <p className="flex min-w-0 items-center gap-1 text-xs text-stone-500">
                        <span className="truncate">{u.selling?.storeName ?? u.email}</span>
                        {u.selling?.verification === 'verified' && <VerifiedBadge size={13} />}
                      </p>
                    </div>
                    <RoleSelect user={u} locked={u.id === currentAdminId || u.isOwner} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={u.status.tone} label={u.status.label} />
                      <IdChip v={u.selling?.verification} />
                    </span>
                    <Actions u={u} selectable={canSelect(u)} isYou={u.id === currentAdminId} />
                  </div>
                  <p className="mt-1.5 text-xs text-stone-500">
                    {u.selling ? `${plural(u.selling.sales, 'product')} sold` : `${plural(u.purchases.items, 'item')} purchased`} · Joined{' '}
                    {formatDateTime(u.createdAt).date}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* ---------- Desktop: table ---------- */}
        <div className="hidden px-3 pb-3 md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className={TABLE_HEAD}>
                <tr>
                  <th scope="col" className="w-10 pl-3">
                    <span className="sr-only">Select</span>
                  </th>
                  <th scope="col" className="px-3">
                    User
                  </th>
                  <th scope="col" className="px-3">
                    Role
                  </th>
                  <th scope="col" className="px-3">
                    Status
                  </th>
                  <th scope="col" className="px-3 text-right">
                    Activity
                  </th>
                  <th scope="col" className="px-3">
                    Joined
                  </th>
                  <th scope="col" className="pr-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {items.map((u) => (
                  <tr key={u.id} className={`relative transition-colors ${selected.has(u.id) ? 'bg-brand-50/60' : 'hover:bg-stone-50/80'}`}>
                    <td className="py-3 pl-3">
                      <RowCheckbox u={u} selectable={canSelect(u)} checked={selected.has(u.id)} onToggle={toggle} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} tone={u.role === 'seller' ? 'brand' : 'stone'} />
                        <div className="min-w-0">
                          {/* Stretched link: the whole row opens the user (checkbox and actions sit above it). */}
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="block max-w-[15rem] truncate font-semibold text-ink after:absolute after:inset-0 hover:underline"
                          >
                            {u.name}
                          </Link>
                          <p className="max-w-[15rem] truncate text-xs text-stone-500">{u.email}</p>
                          {u.selling?.storeName && (
                            <p className="flex max-w-[15rem] items-center gap-1 text-xs font-medium text-brand-800">
                              <span className="truncate">{u.selling.storeName}</span>
                              {u.selling.verification === 'verified' && <VerifiedBadge size={13} />}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <RoleSelect user={u} locked={u.id === currentAdminId || u.isOwner} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex flex-col items-start gap-1">
                        <StatusBadge status={u.status.tone} label={u.status.label} />
                        <IdChip v={u.selling?.verification} />
                      </span>
                    </td>
                    {/* Sellers: what they sold; everyone else: what they bought. */}
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {u.selling ? <Selling s={u.selling} /> : <Purchases p={u.purchases} />}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-stone-600">
                      {formatDateTime(u.createdAt).date}
                      <span className="block text-xs text-stone-400">Active {lastActive(u)}</span>
                    </td>
                    <td className="py-3 pr-3 pl-2 text-right whitespace-nowrap">
                      <Actions u={u} selectable={canSelect(u)} isYou={u.id === currentAdminId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <DeleteUsersDialog
        users={selectedUsers}
        open={bulkOpen && selectedUsers.length > 0}
        onClose={() => setBulkOpen(false)}
        onDeleted={(ids) => setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))))}
      />
    </>
  );
}
