/**
 * Social Publisher Dashboard Page Route
 * Renders the Obsidian Cyber-Glass Social Direct Publisher Cockpit.
 *
 * Layer: Land/App Route | File size: < 200 LOC | Zero :any.
 * @module app/(app)/dashboard/social-publisher/page
 */

export const dynamic = 'force-dynamic';

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { SocialPublisherCockpit } from '@/components/social-publisher/social-publisher-cockpit';
import { listUserCredentials } from '@/land/social/platform-credentials-store';
import type { ChannelCardData, ChannelHealthStatus } from '@/components/social-publisher/channel-credentials-grid';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';

export default async function SocialPublisherPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/vi/login');
  }

  let dbCredentials: Awaited<ReturnType<typeof listUserCredentials>> = [];
  try {
    dbCredentials = await listUserCredentials(user.id);
  } catch {
    // Falls back to empty list on initial database schema provisioning
    dbCredentials = [];
  }

  const channels: ChannelCardData[] = (
    ['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS'] as SocialPlatform[]
  ).map((platform) => {
    const cred = dbCredentials.find((c) => c.platform === platform);
    if (!cred) {
      return {
        platform,
        channelId: `unlinked_${platform.toLowerCase()}`,
        channelName: 'Chưa liên kết / Not connected',
        connected: false,
        status: 'DISCONNECTED' as ChannelHealthStatus,
        dailyPostsUsed: 0,
        dailyPostsMax: platform === 'TIKTOK_V2' ? 8 : platform === 'YOUTUBE_SHORTS' ? 10 : 12,
        tokenExpiresAt: 0,
        killSwitchActive: false,
      };
    }

    const isExpiringSoon = cred.tokenExpiresAt - Date.now() < 3 * 86400000;
    const status: ChannelHealthStatus = cred.killSwitchActive
      ? 'KILL_SWITCH_ACTIVE'
      : isExpiringSoon
      ? 'EXPIRING_SOON'
      : 'HEALTHY';

    return {
      platform,
      channelId: cred.channelId,
      channelName: cred.channelName,
      connected: true,
      status,
      dailyPostsUsed: cred.dailyPostCount,
      dailyPostsMax: platform === 'TIKTOK_V2' ? 8 : platform === 'YOUTUBE_SHORTS' ? 10 : 12,
      tokenExpiresAt: cred.tokenExpiresAt,
      killSwitchActive: cred.killSwitchActive,
    };
  });

  return (
    <main className="p-4 md:p-8 space-y-6">
      <SocialPublisherCockpit initialChannels={channels} />
    </main>
  );
}
