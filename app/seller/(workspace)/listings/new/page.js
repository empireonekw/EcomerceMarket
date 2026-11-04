import ListingForm from '@/components/seller/ListingForm';
import { requireSellerStore } from '@/lib/auth';
import { getCategories } from '@/lib/data/categories';
import { getMarketplaceSettings } from '@/lib/data/settings';
import { uploadDriver } from '@/lib/uploads';

export const metadata = { title: 'New listing' };

export default async function NewListingPage() {
  await requireSellerStore('/seller/listings/new');
  const [categories, settings] = await Promise.all([getCategories(), getMarketplaceSettings()]);
  return <ListingForm categories={categories} uploads={uploadDriver()} autoApprove={settings.autoApproveListings} />;
}
