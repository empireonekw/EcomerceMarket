'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, ImagePlus, X } from 'lucide-react';
import { formatBytes, UPLOAD_RULES, uploadProblem } from '@/lib/listing';
import { uploadFile } from '@/lib/upload-client';

const SHAPES = {
  logo: 'size-28 rounded-full', // shop profile picture
  banner: 'aspect-[4/1] w-full rounded-xl', // shop cover banner
  id: 'aspect-[16/10] w-full rounded-xl', // ID card photo or scan
};

/**
 * One image upload with a preview, for the shop-opening wizard: the shop logo and banner (public `photo` uploads)
 * and the front and back of an ID (private `idDocument` uploads: JPG, PNG or PDF). `value` = the saved location;
 * `serverPreview` = where an already saved private file can be viewed (the ID preview route).
 */
export default function ImageUpload({ id, label, hint, kind, shape, value, onChange, driver, error, serverPreview }) {
  const inputRef = useRef(null);
  const [local, setLocal] = useState(null); // { url, pdf, name } for a file picked in this visit
  const [progress, setProgress] = useState(null);
  const [problem, setProblem] = useState(null);
  const rule = UPLOAD_RULES[kind];
  useEffect(() => () => local?.url && URL.revokeObjectURL(local.url), [local]);

  async function pick(file) {
    if (!file) return;
    const found = uploadProblem(kind, file);
    if (found) return setProblem(found);
    setProblem(null);
    setProgress(0);
    const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    try {
      const { url } = await uploadFile(file, { kind, driver, onProgress: setProgress });
      setLocal({ url: pdf ? null : URL.createObjectURL(file), pdf, name: file.name });
      onChange(url);
    } catch (err) {
      setProblem(err.message);
    } finally {
      setProgress(null);
    }
  }

  // Public images show from their own URL; private ones from this visit's file or the owner-only preview route.
  const isPdf = local?.pdf || /\.pdf$/i.test(value ?? '');
  const preview = !value ? null : kind === 'photo' ? value : (local?.url ?? (serverPreview && !isPdf ? serverPreview : null));
  const message = problem ?? error;

  return (
    <div>
      <p id={`${id}-label`} className="text-sm font-medium text-ink">
        {label}
      </p>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={Object.keys(rule.types)
          .map((ext) => `.${ext}`)
          .join(',')}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className={`mt-2 flex gap-4 ${shape === 'logo' ? 'items-center' : 'flex-col'}`}>
        <button
          id={id}
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!driver || progress != null}
          aria-labelledby={`${id}-label`}
          aria-describedby={message ? `${id}-error` : undefined}
          aria-invalid={Boolean(message) || undefined}
          className={`group relative grid shrink-0 place-items-center overflow-hidden border-2 border-dashed bg-stone-50 transition-colors hover:border-ink disabled:cursor-not-allowed ${SHAPES[shape]} ${
            message ? 'border-red-300' : value ? 'border-transparent' : 'border-stone-300'
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
          ) : value && isPdf ? (
            <span className="flex flex-col items-center gap-1 text-stone-600">
              <FileText size={28} strokeWidth={1.5} aria-hidden="true" />
              <span className="max-w-[12rem] truncate text-xs">{local?.name ?? 'PDF uploaded'}</span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-1 px-3 text-center text-stone-500">
              <ImagePlus size={24} strokeWidth={1.5} aria-hidden="true" />
              <span className="text-xs font-medium">{progress != null ? `Uploading… ${progress}%` : 'Upload'}</span>
            </span>
          )}
          {progress != null && value && (
            <span className="absolute inset-0 grid place-items-center bg-white/80 text-xs font-medium tabular-nums">Uploading… {progress}%</span>
          )}
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
          {value && (
            <>
              <button type="button" onClick={() => inputRef.current?.click()} disabled={!driver} className="btn btn-sm btn-outline">
                Replace
              </button>
              <button
                type="button"
                onClick={() => (setLocal(null), onChange(''))}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-stone-500 hover:bg-red-50 hover:text-red-600"
              >
                <X size={13} strokeWidth={2} aria-hidden="true" />
                Remove
              </button>
            </>
          )}
          <span>
            {rule.label}, up to {formatBytes(rule.maxBytes)}
          </span>
        </div>
      </div>
      {!driver && <p className="mt-1.5 text-xs text-amber-700">File uploads aren’t set up on this site yet.</p>}
      {message && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-red-600">
          {message}
        </p>
      )}
    </div>
  );
}
