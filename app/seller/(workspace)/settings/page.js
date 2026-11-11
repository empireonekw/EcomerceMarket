import Link from '@/components/PrefetchLink';
import { ExternalLink } from 'lucide-react';
import ShopContactForm from '@/components/seller/ShopContactForm';
import ShopDetailsForm from '@/components/seller/ShopDetailsForm';
import { PageHeader, Panel } from '@/components/dashboard/ui';
import { requireSellerStore } from '@/lib/auth';
import { getShopSettings } from '@/lib/data/seller';
import { uploadDriver } from '@/lib/uploads';

export const metadata = { title: 'Shop Settings' };

/**
 * Seller → Shop Settings: everything entered when the shop was opened (/sell-on-sellpify) can be changed here: the
 * public profile (name, description, profile picture, banner) and the private location, address and phone.
 * Payout details live on /seller/payouts.
 */
export default async function SellerSettingsPage() {
  const seller = await requireSellerStore('/seller/settings');
  const data = await getShopSettings(seller.id);

  return (
    <>
      <PageHeader
        title="Shop Settings"
        description="Change your shop’s name, description, profile picture and banner, and the details you gave when you opened it."
        actions={
          <Link href={`/shop/${seller.id}`} className="btn btn-md btn-outline">
            <ExternalLink size={15} strokeWidth={1.75} aria-hidden="true" />
            View my shop
          </Link>
        }
      />

      <div className="space-y-8">
        <Panel title="Shop profile" id="profile">
          <div className="p-5 sm:p-6">
            <p className="mb-6 text-sm text-stone-500">Buyers see this on your shop page and next to your listings.</p>
            <ShopDetailsForm initial={data.profile} uploads={uploadDriver()} />
          </div>
        </Panel>

        <Panel title="Location & contact" id="contact">
          <div className="p-5 sm:p-6">
            <p className="mb-6 text-sm text-stone-500">
              Your address and phone stay private: only you and the Sellpify team see them. Buyers only see your shop’s country.
            </p>
            <ShopContactForm initial={data.contact} />
          </div>
        </Panel>

        <Panel
          title="Payouts & bank details"
          action={
            <Link href="/seller/payouts" className="text-sm font-medium text-stone-500 hover:text-ink">
              Open
            </Link>
          }
        >
          <p className="p-5 text-sm text-stone-600 sm:p-6">
            Your bank account or wallet is managed on{' '}
            <Link href="/seller/payouts" className="font-medium text-ink underline underline-offset-2">
              Payouts &amp; Bank Details
            </Link>
            .
          </p>
        </Panel>
      </div>
    </>
  );
}
