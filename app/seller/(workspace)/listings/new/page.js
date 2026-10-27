import ListingForm from '@/components/seller/ListingForm';
import { requireSellerStore } from '@/lib/auth';
import { getCategories } from '@/lib/data/categories';
import { uploadDriver } from '@/lib/uploads';

export const metadata = { title: 'New listing' };

export default async function NewListingPage() {
  await requireSellerStore('/seller/listings/new');
  const categories = await getCategories();
  return <ListingForm categories={categories} uploads={uploadDriver()} />;
}
