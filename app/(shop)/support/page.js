import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { openSupportThread } from '@/lib/data/messages';

export const metadata = { title: 'Help & support', robots: { index: false, follow: false } };

/**
 * /support — "Help & support" everywhere links here: opens the signed-in user's chat with the Sellpify team (created
 * on first use), in the seller's or buyer's inbox. Guests log in first and come back; admins go to their support inbox.
 */
export default async function SupportPage() {
  const user = await requireUser('/support');
  if (user.role === 'admin') redirect('/admin/messages');
  const { conversationId } = await openSupportThread(user.id);
  redirect(`${user.role === 'seller' ? '/seller/messages' : '/messages'}?folder=site&c=${conversationId}`);
}
