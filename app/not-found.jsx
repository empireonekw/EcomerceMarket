import Link from 'next/link';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div className="max-w-md">
        <p className="text-sm font-medium text-brand-600">404</p>
        <h1 className="mt-2 text-3xl headline">We couldn’t find that page.</h1>
        <p className="mt-3 text-stone-600">The product may have been unpublished or the link is incorrect.</p>
        <Link
          href="/products"
          className="btn btn-md btn-dark mt-8"
        >
          Browse products
        </Link>
      </div>
    </div>
  );
}
