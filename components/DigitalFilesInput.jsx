'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { formatBytes, LISTING_LIMITS, PRODUCT_UPLOAD_MAX_BYTES, UPLOAD_RULES, uploadProblem } from '@/lib/listing';
import { uploadFile } from '@/lib/upload-client';

const ACCEPT = Object.keys(UPLOAD_RULES.source.types)
  .map((ext) => `.${ext}`)
  .join(',');
const fmtDate = (value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
let uploadKey = 0;

/**
 * The files buyers get after paying (seller listing form and admin product form): up to LISTING_LIMITS.files, each up
 * to 20 MB, listed with the name buyers will see, its size and upload date. Everything uploaded for the product
 * (`otherBytes` = its photos and videos) must stay within PRODUCT_UPLOAD_MAX_BYTES. The server checks all of it again.
 * `onChange(update)` gets a function of the previous list (uploads can finish in any order); `onBusy(bool)` says
 * whether uploads are still running.
 */
export default function DigitalFilesInput({ files, onChange, onBusy, driver, error, otherBytes = 0, inputId = 'source-upload' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState([]); // { key, name, size, progress }
  const [problems, setProblems] = useState([]);
  const [dropActive, setDropActive] = useState(false);
  // The form waits for uploads still running before it saves.
  const busy = uploading.length > 0;
  useEffect(() => onBusy?.(busy), [busy, onBusy]);

  const used = otherBytes + files.reduce((sum, f) => sum + (Number(f.size) || 0), 0) + uploading.reduce((sum, u) => sum + u.size, 0);
  const slotsLeft = LISTING_LIMITS.files - files.length - uploading.length;

  function addFiles(list) {
    const found = [];
    let budget = PRODUCT_UPLOAD_MAX_BYTES - used;
    let slots = slotsLeft;
    const taken = new Set([...files.map((f) => f.name.toLowerCase()), ...uploading.map((u) => u.name.toLowerCase())]);
    for (const file of list) {
      const problem = uploadProblem('source', file);
      if (problem) found.push(problem);
      else if (slots <= 0) found.push(`${file.name}: a listing can have up to ${LISTING_LIMITS.files} files.`);
      else if (taken.has(file.name.toLowerCase())) found.push(`A file named ${file.name} is already in the list.`);
      else if (file.size > budget)
        found.push(`${file.name} (${formatBytes(file.size)}) doesn’t fit: photos, videos and files can add up to ${formatBytes(PRODUCT_UPLOAD_MAX_BYTES)} per listing.`);
      else {
        slots -= 1;
        budget -= file.size;
        taken.add(file.name.toLowerCase());
        start(file);
      }
    }
    setProblems(found);
  }

  async function start(file) {
    const key = ++uploadKey;
    setUploading((u) => [...u, { key, name: file.name, size: file.size, progress: 0 }]);
    try {
      const { url, size } = await uploadFile(file, {
        kind: 'source',
        driver,
        onProgress: (progress) => setUploading((u) => u.map((x) => (x.key === key ? { ...x, progress } : x))),
      });
      onChange((prev) => [...prev, { url, name: file.name, size, uploadedAt: new Date().toISOString() }]);
    } catch (err) {
      setProblems((p) => [...p, err.message]);
    } finally {
      setUploading((u) => u.filter((x) => x.key !== key));
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(e) => {
          addFiles([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />

      {(files.length > 0 || uploading.length > 0) && (
        <ul className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-200" aria-label="Uploaded files">
          {files.map((f, i) => (
            <li key={f.url} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-600">
                <FileText size={18} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm font-medium">{f.name}</p>
                <p className="text-xs text-stone-500">
                  {f.size ? formatBytes(f.size) : 'Size checked on save'}
                  {f.uploadedAt && ` · Uploaded ${fmtDate(f.uploadedAt)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange((prev) => prev.filter((_, k) => k !== i))}
                aria-label={`Remove ${f.name}`}
                className="grid size-8 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-600"
              >
                <X size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
          {uploading.map((u) => (
            <li key={u.key} className="px-4 py-3" role="status">
              <div className="flex justify-between gap-3 text-sm">
                <span className="min-w-0 break-all font-medium">{u.name}</span>
                <span className="shrink-0 tabular-nums text-stone-500">{u.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${u.progress}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {slotsLeft > 0 &&
        (driver ? (
          <div
            onDragOver={(e) => (e.preventDefault(), setDropActive(true))}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              addFiles([...(e.dataTransfer.files ?? [])]);
            }}
            className={`mt-3 rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors ${
              dropActive ? 'border-brand-600 bg-brand-50/60' : error ? 'border-red-300 bg-red-50/40' : 'border-stone-300 bg-stone-50'
            }`}
          >
            <p className="font-medium">{files.length ? 'Add more files' : 'Drag and drop your files, or'}</p>
            <button
              id={inputId}
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn btn-md mt-3 bg-stone-200/80 text-black hover:bg-stone-300"
            >
              <Upload size={17} strokeWidth={2} aria-hidden="true" />
              {files.length ? 'Upload more' : 'Upload files'}
            </button>
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
            File uploads aren’t set up on this site yet. Choose <span className="font-medium">Add a link</span> to deliver from Canva, Google Drive,
            Dropbox or similar.
          </p>
        ))}

      <p className="mt-2 text-xs text-stone-500">
        {files.length} of {LISTING_LIMITS.files} files · {formatBytes(Math.max(used, 0))} of {formatBytes(PRODUCT_UPLOAD_MAX_BYTES)} used by this listing’s
        photos, videos and files
      </p>
      {problems.map((p) => (
        <p key={p} role="alert" className="mt-1.5 text-sm font-medium text-red-600">
          {p}
        </p>
      ))}
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
