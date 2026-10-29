'use client';

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, Trash2 } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';
import { siteConfig } from '@/lib/site';
import { CATEGORY_TYPES, categoryHref, categorySlug, categoryTypeLabel, MAX_CATEGORY_LEVELS, orderTree, subtreeLevels } from '@/lib/category-tree';

const siteHost = siteConfig.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
const EMPTY = { main: '', sub: '', inner: '', name: '', slug: '', parent: '', description: '', type: 'digital', metaTitle: '', metaDescription: '' };
const LEVELS = [
  { key: 'main', label: 'Main category', placeholder: 'e.g. Templates', help: 'Type a new main category, or an existing one to add under it.' },
  { key: 'sub', label: 'Sub category', placeholder: 'e.g. Business', help: 'Optional. Leave empty to add just the main category.' },
  { key: 'inner', label: 'Inner category', placeholder: 'e.g. Invoices', help: 'Optional. The most specific level — the best match for search engines.' },
];
const lower = (s) => s.trim().toLowerCase();
const optionalFields = (v) => ({ description: v.description, type: v.type, metaTitle: v.metaTitle, metaDescription: v.metaDescription });
/** The deepest name typed in the add form (the category being created). */
const deepest = (v) => [v.inner, v.sub, v.main].map((n) => n.trim()).find(Boolean) ?? '';
const inputCls = (err) =>
  `mt-1.5 w-full rounded-xl border bg-white px-3.5 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
    err ? 'border-red-400 focus:border-red-500' : 'border-stone-300 hover:border-stone-400 focus:border-ink'
  }`;

function FieldHelp({ id, error, children }) {
  if (error)
    return (
      <p id={id} className="mt-1.5 text-xs font-medium text-red-600">
        {error}
      </p>
    );
  return children ? <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{children}</p> : null;
}

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  slug: (a, b) => a.slug.localeCompare(b.slug),
  count: (a, b) => a.count - b.count || a.name.localeCompare(b.name),
};

/**
 * Admin → Categories (WordPress-style): "Add New Category" form on the left (it becomes "Edit Category" when a row
 * is edited) and every category on the right — tree-indented, sortable, searchable, with bulk delete and
 * Edit / Delete / View row actions. Writes go to /api/admin/categories; the page re-renders from the server.
 */
export default function CategoryManager({ categories }) {
  const router = useRouter();
  const toast = useToast();
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const dialogTitle = useId();
  const [refreshing, startRefresh] = useTransition();

  const [editingId, setEditingId] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [selected, setSelected] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [toDelete, setToDelete] = useState([]);
  const [deleting, setDeleting] = useState(false);

  // Tree order with siblings sorted by the chosen column; search shows matches flat, with their full path.
  const rows = useMemo(() => {
    const compare = (a, b) => (sort.dir === 'asc' ? 1 : -1) * SORTS[sort.key](a, b);
    const ordered = orderTree(categories, compare);
    const term = query.trim().toLowerCase();
    if (!term) return ordered;
    return ordered.filter((c) => [c.name, c.slug, c.description ?? ''].some((v) => v.toLowerCase().includes(term)));
  }, [categories, sort, query]);
  const tree = useMemo(() => orderTree(categories), [categories]);
  const byId = useMemo(() => new Map(tree.map((c) => [c._id, c])), [tree]);

  // A category was deleted elsewhere (or by bulk): drop it from the selection / edit form.
  useEffect(() => {
    setSelected((s) => new Set([...s].filter((id) => byId.has(id))));
    if (editingId && !byId.has(editingId)) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byId]);

  // Where the category in the form may go: not inside itself or its own sub-categories, and within 3 levels.
  const parentOptions = useMemo(() => {
    const levels = editingId ? subtreeLevels(editingId, tree) : 1;
    return tree.filter((c) => c._id !== editingId && !c.ancestors.includes(editingId) && c.depth + levels <= MAX_CATEGORY_LEVELS - 1);
  }, [tree, editingId]);

  // Suggestions for the add form: existing main categories, then the subs / inners under what's typed above.
  const suggestions = useMemo(() => {
    const mains = tree.filter((c) => c.depth === 0);
    const main = mains.find((c) => lower(c.name) === lower(values.main));
    const subs = main ? tree.filter((c) => c.parent === main._id) : [];
    const sub = subs.find((c) => lower(c.name) === lower(values.sub));
    const inners = sub ? tree.filter((c) => c.parent === sub._id) : [];
    return { main: mains, sub: subs, inner: inners, matched: { main, sub } };
  }, [tree, values.main, values.sub]);

  function resetForm() {
    setEditingId(null);
    setValues(EMPTY);
    setSlugTouched(false);
    setErrors({});
  }

  function startEdit(c) {
    setEditingId(c._id);
    setValues({
      ...EMPTY,
      name: c.name,
      slug: c.slug,
      parent: c.parent ?? '',
      description: c.description ?? '',
      type: c.type ?? 'digital',
      metaTitle: c.metaTitle ?? '',
      metaDescription: c.metaDescription ?? '',
    });
    setSlugTouched(true); // an existing slug is part of live URLs: never rewrite it silently
    setErrors({});
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('cat-name')?.focus({ preventScroll: true }), 300);
  }

  function update(key, value) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (!slugTouched && key === 'name') next.slug = categorySlug(value);
      if (!slugTouched && ['main', 'sub', 'inner'].includes(key)) next.slug = categorySlug(deepest(next));
      return next;
    });
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const found = {};
    const name = editingId ? values.name : deepest(values);
    if (editingId && !values.name.trim()) found.name = 'Enter a name.';
    if (!editingId && !values.main.trim()) found.main = 'Enter a main category.';
    if (!editingId && values.inner.trim() && !values.sub.trim()) found.sub = 'Enter a sub category before the inner category.';
    if (name && !categorySlug(values.slug || name)) found.slug = 'Enter a slug (letters, numbers and hyphens).';
    setErrors(found);
    if (Object.keys(found).length) return document.getElementById(`cat-${Object.keys(found)[0]}`)?.focus();

    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/admin/categories/${editingId}` : '/api/admin/categories', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId
            ? { name: values.name, slug: categorySlug(values.slug || values.name), parent: values.parent || null, ...optionalFields(values) }
            : { main: values.main, sub: values.sub, inner: values.inner, slug: categorySlug(values.slug || name), ...optionalFields(values) },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields ?? {});
        toast.error(editingId ? 'Category not updated' : 'Category not added', data.error);
        return;
      }
      toast.success(editingId ? `“${data.name}” updated` : `“${data.path ?? data.name}” added`);
      resetForm();
      startRefresh(() => router.refresh());
    } catch {
      toast.error('Network error', 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  function askDelete(ids) {
    setToDelete(ids);
    dialogRef.current?.showModal();
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch('/api/admin/categories/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: toDelete }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete.');
      dialogRef.current?.close();
      if (data.deleted.length) {
        const moved = data.deleted.reduce((n, d) => n + d.productsMoved, 0);
        toast.success(
          data.deleted.length === 1 ? `“${data.deleted[0].name}” deleted` : `${data.deleted.length} categories deleted`,
          moved ? `${moved} product${moved === 1 ? '' : 's'} moved to the parent category.` : undefined,
        );
      }
      for (const s of data.skipped) toast.error(`“${s.name}” not deleted`, s.reason);
      setSelected(new Set());
      startRefresh(() => router.refresh());
    } catch (err) {
      toast.error('Could not delete', err.message);
    } finally {
      setDeleting(false);
    }
  }

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'count' ? 'desc' : 'asc' }));
  }

  const visibleIds = rows.map((c) => c._id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selected.has(id));
  const pendingDelete = toDelete.map((id) => byId.get(id)).filter(Boolean);
  const childrenOf = (id) => tree.filter((c) => c.parent === id);

  const sortHeader = (k, label, className = '') => {
    const Icon = sort.key !== k ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th
        key={k}
        scope="col"
        aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
        className={`px-4 py-3 ${className}`}
      >
        <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-black">
          {label}
          <Icon size={13} strokeWidth={2} aria-hidden="true" className={sort.key === k ? 'text-black' : 'text-stone-400'} />
        </button>
      </th>
    );
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      {/* ---------- Add / edit form ---------- */}
      <section
        ref={formRef}
        aria-labelledby="cat-form-title"
        className="scroll-mt-24 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 lg:sticky lg:top-10"
      >
        <h2 id="cat-form-title" className="headline text-2xl">
          {editingId ? 'Edit Category' : 'Add New Category'}
        </h2>
        {editingId && (
          <p className="mt-1 text-sm text-stone-500">
            Editing <span className="font-medium text-black">{byId.get(editingId)?.path}</span>
          </p>
        )}
        <form onSubmit={onSubmit} noValidate className="mt-5 space-y-5">
          {editingId ? (
            <div>
              <label htmlFor="cat-name" className="text-sm font-medium">
                Name <span className="text-red-600">*</span>
              </label>
              <input
                id="cat-name"
                value={values.name}
                maxLength={60}
                onChange={(e) => update('name', e.target.value)}
                aria-invalid={Boolean(errors.name) || undefined}
                aria-describedby="cat-name-help"
                className={`${inputCls(errors.name)} h-11`}
              />
              <FieldHelp id="cat-name-help" error={errors.name}>
                The name is how it appears on your site.
              </FieldHelp>
            </div>
          ) : (
            <fieldset className="space-y-4">
              <legend className="sr-only">Category path</legend>
              {LEVELS.map((level, i) => {
                const disabled = i > 0 && !values[LEVELS[i - 1].key].trim();
                const exists = i < 2 && suggestions.matched[level.key];
                return (
                  <div key={level.key}>
                    <label htmlFor={`cat-${level.key}`} className="text-sm font-medium">
                      {level.label} {i === 0 ? <span className="text-red-600">*</span> : <span className="font-normal text-stone-400">(optional)</span>}
                    </label>
                    <input
                      id={`cat-${level.key}`}
                      list={`cat-${level.key}-options`}
                      value={values[level.key]}
                      maxLength={60}
                      disabled={disabled}
                      placeholder={level.placeholder}
                      autoComplete="off"
                      onChange={(e) => update(level.key, e.target.value)}
                      aria-invalid={Boolean(errors[level.key]) || undefined}
                      aria-describedby={`cat-${level.key}-help`}
                      className={`${inputCls(errors[level.key])} h-11 disabled:cursor-not-allowed disabled:bg-stone-50`}
                    />
                    <datalist id={`cat-${level.key}-options`}>
                      {suggestions[level.key].map((c) => (
                        <option key={c._id} value={c.name} />
                      ))}
                    </datalist>
                    <FieldHelp id={`cat-${level.key}-help`} error={errors[level.key]}>
                      {exists && values[LEVELS[i + 1].key].trim() ? `Existing “${exists.name}” — the new category goes under it.` : level.help}
                    </FieldHelp>
                  </div>
                );
              })}
            </fieldset>
          )}

          <div>
            <label htmlFor="cat-slug" className="text-sm font-medium">
              Slug
            </label>
            <input
              id="cat-slug"
              value={values.slug}
              maxLength={80}
              onChange={(e) => {
                setSlugTouched(true);
                update('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
              onBlur={() => setValues((v) => ({ ...v, slug: categorySlug(v.slug) }))}
              aria-invalid={Boolean(errors.slug) || undefined}
              aria-describedby="cat-slug-help"
              className={`${inputCls(errors.slug)} h-11 font-mono text-[13px]`}
            />
            <FieldHelp id="cat-slug-help" error={errors.slug}>
              The URL-friendly version of the {editingId ? 'name' : 'deepest category you typed'}: lowercase letters, numbers and hyphens. Filled in
              automatically until you edit it.
              {editingId && ' Changing it changes the category’s link.'}
            </FieldHelp>
          </div>

          {editingId && (
            <div>
              <label htmlFor="cat-parent" className="text-sm font-medium">
                Parent Category
              </label>
              <select
                id="cat-parent"
                value={values.parent}
                onChange={(e) => update('parent', e.target.value)}
                aria-invalid={Boolean(errors.parent) || undefined}
                aria-describedby="cat-parent-help"
                className={`${inputCls(errors.parent)} h-11`}
              >
                <option value="">None</option>
                {parentOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {`${'— '.repeat(c.depth)}${c.name}`}
                  </option>
                ))}
              </select>
              <FieldHelp id="cat-parent-help" error={errors.parent}>
                Choose a parent to make this a sub-category (up to {MAX_CATEGORY_LEVELS} levels: main › sub › inner). “None” makes it a main category.
              </FieldHelp>
            </div>
          )}

          <div>
            <label htmlFor="cat-description" className="text-sm font-medium">
              Description <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <textarea
              id="cat-description"
              rows={4}
              maxLength={300}
              value={values.description}
              onChange={(e) => update('description', e.target.value)}
              aria-invalid={Boolean(errors.description) || undefined}
              aria-describedby="cat-description-help"
              className={`${inputCls(errors.description)} resize-y py-2.5 leading-relaxed`}
            />
            <FieldHelp id="cat-description-help" error={errors.description}>
              {values.description.length}/300 · Shown on the category page and in the Shop menu.
            </FieldHelp>
          </div>

          <div>
            <label htmlFor="cat-type" className="text-sm font-medium">
              What can be listed here
            </label>
            <select id="cat-type" value={values.type} onChange={(e) => update('type', e.target.value)} className={`${inputCls()} h-11`}>
              {CATEGORY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <FieldHelp>Shown as a badge when sellers search for a category.</FieldHelp>
          </div>

          {/* ---------- SEO ---------- */}
          <fieldset className="space-y-4 rounded-xl border border-stone-200 p-4">
            <legend className="px-1 text-sm font-medium">Search engines (SEO)</legend>
            <p className="break-all rounded-lg bg-stone-50 px-3 py-2 font-mono text-xs text-stone-600">
              {siteHost}
              {categoryHref({
                slugPath: editingId
                  ? [
                      ...(byId.get(values.parent)?.slugPath ? [byId.get(values.parent).slugPath] : []),
                      categorySlug(values.slug || values.name) || 'slug',
                    ].join('/')
                  : [values.main, values.sub, values.inner]
                      .map((n) => n.trim())
                      .filter(Boolean)
                      .map((n, i, all) => (i === all.length - 1 ? categorySlug(values.slug || n) : categorySlug(n)))
                      .join('/') || 'slug',
              })}
            </p>
            <div>
              <label htmlFor="cat-metaTitle" className="text-sm font-medium">
                SEO title <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <input
                id="cat-metaTitle"
                value={values.metaTitle}
                maxLength={70}
                placeholder={(editingId ? values.name : deepest(values)) || 'Defaults to the name'}
                onChange={(e) => update('metaTitle', e.target.value)}
                aria-invalid={Boolean(errors.metaTitle) || undefined}
                className={`${inputCls(errors.metaTitle)} h-11`}
              />
              <FieldHelp error={errors.metaTitle}>{values.metaTitle.length}/70 · The page title in Google results.</FieldHelp>
            </div>
            <div>
              <label htmlFor="cat-metaDescription" className="text-sm font-medium">
                SEO description <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <textarea
                id="cat-metaDescription"
                rows={3}
                maxLength={160}
                value={values.metaDescription}
                placeholder={values.description || 'Defaults to the description'}
                onChange={(e) => update('metaDescription', e.target.value)}
                aria-invalid={Boolean(errors.metaDescription) || undefined}
                className={`${inputCls(errors.metaDescription)} resize-y py-2.5 leading-relaxed`}
              />
              <FieldHelp error={errors.metaDescription}>
                {values.metaDescription.length}/160 · The snippet under the title in Google results.
              </FieldHelp>
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn btn-md btn-primary">
              {saving && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add New Category'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btn btn-md btn-outline">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* ---------- Table ---------- */}
      <section aria-label="Categories" className={`min-w-0 transition-opacity ${refreshing ? 'opacity-60' : ''}`}>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="cat-bulk" className="sr-only">
              Bulk actions
            </label>
            <select
              id="cat-bulk"
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="h-10 rounded-full border border-stone-300 bg-white px-4 text-sm focus:border-ink focus:outline-none"
            >
              <option value="">Bulk actions</option>
              <option value="delete">Delete</option>
            </select>
            <button
              type="button"
              disabled={!bulkAction || !selected.size}
              onClick={() => bulkAction === 'delete' && askDelete([...selected])}
              className="btn btn-sm btn-outline h-10 disabled:opacity-40"
            >
              Apply
            </button>
            {selected.size > 0 && <span className="text-sm text-stone-500">{selected.size} selected</span>}
          </div>
          <div className="relative sm:w-64">
            <label htmlFor="cat-search" className="sr-only">
              Search categories
            </label>
            <Search
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              id="cat-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories"
              className="h-10 w-full rounded-full border border-stone-300 bg-white pl-10 pr-4 text-sm focus:border-ink focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium text-stone-500">
                <tr>
                  <th scope="col" className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all categories"
                      checked={allSelected}
                      ref={(el) => el && (el.indeterminate = someSelected)}
                      onChange={() =>
                        setSelected((s) => {
                          const next = new Set(s);
                          visibleIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
                          return next;
                        })
                      }
                      className="size-4 accent-brand-600"
                    />
                  </th>
                  {sortHeader('name', 'Name')}
                  <th scope="col" className="px-4 py-3 uppercase tracking-wide">
                    Description
                  </th>
                  {sortHeader('slug', 'Slug')}
                  {sortHeader('count', 'Count', 'text-right')}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-stone-500">
                      {query ? `No categories match “${query}”.` : 'No categories yet — add your first one on the left.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => {
                    const isSelected = selected.has(c._id);
                    const isEditing = editingId === c._id;
                    return (
                      <tr
                        key={c._id}
                        className={`group align-top ${isEditing ? 'bg-brand-50/60' : isSelected ? 'bg-stone-50' : 'hover:bg-stone-50/70'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${c.path}`}
                            checked={isSelected}
                            onChange={() =>
                              setSelected((s) => {
                                const next = new Set(s);
                                if (next.has(c._id)) next.delete(c._id);
                                else next.add(c._id);
                                return next;
                              })
                            }
                            className="mt-0.5 size-4 accent-brand-600"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start" style={{ paddingLeft: query ? 0 : `${Math.max(0, c.depth - 1) * 1.25}rem` }}>
                            {c.depth > 0 && !query && (
                              <span aria-hidden="true" className="mr-2 mt-0.5 h-2.5 w-3 shrink-0 rounded-bl border-b-2 border-l-2 border-stone-300" />
                            )}
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => startEdit(c)}
                                className="text-left font-medium text-black hover:text-brand-600 hover:underline"
                              >
                                {query && c.depth > 0 ? c.path : c.name}
                              </button>
                              {c.depth > 0 && !query && (
                                <span className="ml-2 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-500">
                                  {c.depth === 1 ? 'Sub' : 'Inner'}
                                </span>
                              )}
                              {/* Row actions: shown on hover / keyboard focus (always on touch screens). */}
                              <div className="mt-1 flex items-center gap-1.5 text-xs opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                                <button type="button" onClick={() => startEdit(c)} className="font-medium text-brand-600 hover:underline">
                                  Edit
                                </button>
                                <span aria-hidden="true" className="text-stone-300">
                                  |
                                </span>
                                <button type="button" onClick={() => askDelete([c._id])} className="font-medium text-red-600 hover:underline">
                                  Delete
                                </button>
                                <span aria-hidden="true" className="text-stone-300">
                                  |
                                </span>
                                <a
                                  href={categoryHref(c)}
                                  target="_blank"
                                  rel="noopener"
                                  className="font-medium text-stone-600 hover:text-black hover:underline"
                                >
                                  View
                                </a>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[18rem] px-4 py-3 text-stone-600">
                          {c.description ? <span className="line-clamp-2">{c.description}</span> : <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="block font-mono text-xs text-stone-600">{categoryHref(c)}</span>
                          <span className="mt-1 inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                            {categoryTypeLabel(c.type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {c.count > 0 ? (
                            <Link href={`/admin/products?category=${c._id}`} className="font-medium text-brand-600 hover:underline">
                              {c.count}
                            </Link>
                          ) : (
                            <span className="text-stone-400">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · Count = products directly in that category. Deleting a category moves
          its sub-categories and products up to its parent.
        </p>
      </section>

      {/* ---------- Delete confirmation ---------- */}
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitle}
        onClick={(e) => e.target === e.currentTarget && !deleting && e.currentTarget.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
      >
        <div className="p-6">
          <span className="grid size-11 place-items-center rounded-full bg-red-50 text-red-600">
            <Trash2 size={20} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 id={dialogTitle} className="mt-4 text-lg font-medium">
            Are you sure you want to delete?
          </h2>
          <p className="mt-1 text-sm font-medium text-stone-800">
            {pendingDelete.length === 1 ? pendingDelete[0].path : `${pendingDelete.length} categories`}
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-stone-600 marker:text-stone-400">
            {pendingDelete.map((c) => {
              const kids = childrenOf(c._id).length;
              const parent = c.parent ? byId.get(c.parent)?.name : null;
              return (
                <li key={c._id}>
                  {pendingDelete.length > 1 && <span className="font-medium text-stone-800">{c.name}: </span>}
                  {c.count > 0
                    ? parent
                      ? `its ${c.count} product${c.count === 1 ? '' : 's'} move to “${parent}”`
                      : `can’t be deleted while it has ${c.count} product${c.count === 1 ? '' : 's'}`
                    : 'no products'}
                  {kids > 0 &&
                    `; its ${kids} sub-categor${kids === 1 ? 'y moves' : 'ies move'} up${parent ? ` to “${parent}”` : ' to main categories'}`}
                  .
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={deleting}
              className="btn btn-md text-stone-700 hover:bg-stone-100"
            >
              No
            </button>
            <button type="button" onClick={confirmDelete} disabled={deleting} className="btn btn-md bg-red-600 text-white hover:bg-red-700">
              {deleting && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
