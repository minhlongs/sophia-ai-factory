/**
 * OAuth Channels page — /dashboard/integrations/channels
 * 1-click connect for YouTube, TikTok, Instagram, Pinterest, LinkedIn, Zalo.
 * @module app/[locale]/dashboard/integrations/channels/page
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import ChannelsClient from './channels-client';

export const dynamic = 'force-dynamic';

export default async function ChannelsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  // Channel status is fetched client-side to avoid D1 async complexity in RSC
  return <ChannelsClient userId={user.id} />;
}
