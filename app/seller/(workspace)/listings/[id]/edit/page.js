import { notFound } from 'next/navigation';
import ListingForm from '@/components/seller/ListingForm';
import { requireSellerStore } from '@/lib/auth';
import { getCategories } from '@/lib/data/categories';
import { getSellerProductForEdit } from '@/lib/data/seller';
import { uploadDriver } from '@/lib/uploads';

export const metadata = { title: 'Edit listing' };

/** Seller edits one of their own listings. Publishing sends it back to review; it can also go back to being a draft. */
export default async function EditListingPage({ params }) {
  const { id } = await params;
  const seller = await requireSellerStore(`/seller/listings/${id}/edit`);
  const [listing, categories] = await Promise.all([getSellerProductForEdit(seller.id, id), getCategories()]);
  if (!listing) notFound();

  // key: remount the form when moving between two listings' edit pages.
  return <ListingForm key={listing._id} categories={categories} listing={listing} uploads={uploadDriver()} />;
}
