import Inbox from '@/components/messages/Inbox';
import { requireUser } from '@/lib/auth';
import { getMessagingSettings, listConversations } from '@/lib/data/messages';

export const metadata = { title: 'Messages', robots: { index: false, follow: false } };

/** A signed-in user's conversations with shops (sellers see their shop's threads here too). */
export default async function MessagesPage({ searchParams }) {
  const user = await requireUser('/messages');
  const sp = await searchParams;
  const [initialList, initialSettings] = await Promise.all([
    listConversations(user.id, { folder: sp.folder, label: sp.label, q: sp.q, page: sp.page }),
    getMessagingSettings(user.id),
  ]);
  return (
    <div className="container-page py-6 sm:py-10">
      <Inbox initialList={initialList} initialSettings={initialSettings} />
    </div>
  );
}
