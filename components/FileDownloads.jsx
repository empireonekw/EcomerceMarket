import { Download, FileText } from 'lucide-react';
import { formatBytes } from '@/lib/listing';

/** A purchase's files, one download each (receipt page and My Purchases), for products with more than one file. */
export default function FileDownloads({ files }) {
  return (
    <ul className="w-full divide-y divide-stone-100 rounded-xl border border-stone-200 sm:basis-full" aria-label="Files">
      {files.map((f) => (
        <li key={f.url} className="flex items-center gap-3 px-4 py-3">
          <FileText size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-stone-400" />
          <span className="min-w-0 flex-1">
            <span className="block break-all text-sm font-medium text-ink">{f.name}</span>
            {f.size > 0 && <span className="text-xs text-stone-500">{formatBytes(f.size)}</span>}
          </span>
          <a href={f.url} rel="noreferrer" className="btn btn-sm btn-outline shrink-0" aria-label={`Download ${f.name}`}>
            <Download size={15} strokeWidth={2} aria-hidden="true" />
            Download
          </a>
        </li>
      ))}
    </ul>
  );
}
