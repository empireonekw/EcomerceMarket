import { Download, ExternalLink, FileText } from 'lucide-react';
import { Panel } from '@/components/dashboard/ui';
import { formatBytes } from '@/lib/listing';

/**
 * Admin → Edit product: the files buyers get, each with Open (view in the browser) and Download,
 * so an admin can check a seller's PDF is genuine before approving the listing.
 */
export default function ListingFiles({ product }) {
  const base = `/api/admin/products/${product._id}/files`;
  const external = product.deliveryType === 'external';
  if (!external && !product.files?.length) return null;

  return (
    <div className="mb-6">
      <Panel id="files" title="Check the seller’s files">
        {external ? (
          <p className="px-5 py-4 text-sm text-stone-600">
            Buyers get an access link:{' '}
            <a href={base + '/0'} target="_blank" rel="noreferrer" className="font-medium break-all text-brand-700 hover:underline">
              {product.downloadUrl}
            </a>
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {product.files.map((f, i) => (
              <li key={f.url} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <FileText size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-stone-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium break-all text-ink">{f.name}</span>
                  {f.size > 0 && <span className="text-xs text-stone-500">{formatBytes(f.size)}</span>}
                </span>
                <a href={`${base}/${i}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline" aria-label={`Open ${f.name}`}>
                  <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
                  Open
                </a>
                <a href={`${base}/${i}?download=1`} className="btn btn-sm btn-outline" aria-label={`Download ${f.name}`}>
                  <Download size={15} strokeWidth={2} aria-hidden="true" />
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
