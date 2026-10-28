import Inbox from '@/components/messages/Inbox';
import { requireSellerStore } from '@/lib/auth';
import { getMessagingSettings, listConversations } from '@/lib/data/messages';

export const metadata = { title: 'Messages' };

/** Shop inbox: conversations with buyers, plus notices from the marketplace. */
export default async function SellerMessagesPage({ searchParams }) {
  const seller = await requireSellerStore('/seller/messages');
  const sp = await searchParams;
  const [initialList, initialSettings] = await Promise.all([
    listConversations(seller.id, { folder: sp.folder, label: sp.label, q: sp.q, page: sp.page }),
    getMessagingSettings(seller.id),
  ]);
  return <Inbox initialList={initialList} initialSettings={initialSettings} fullBleed />;
}
