'use client';

import { useAuth } from '@/context/AuthContext';
import { MessagingProvider } from '@/components/messages/MessagingProvider';

/** Storefront: live messaging only for signed-in visitors (guests never open a socket or poll). */
export default function ShopMessaging({ children }) {
  const { user } = useAuth();
  return <MessagingProvider enabled={Boolean(user)}>{children}</MessagingProvider>;
}
