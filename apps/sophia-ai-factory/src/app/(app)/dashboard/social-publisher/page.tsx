/**
 * Social Publisher Dashboard Page Route
 * Renders the Obsidian Cyber-Glass Social Direct Publisher Cockpit.
 *
 * Layer: Land/App Route | File size: < 120 LOC | Zero :any.
 * @module app/(app)/dashboard/social-publisher/page
 */

export const dynamic = 'force-dynamic';

import React from 'react';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { SocialPublisherPageClient } from '@/components/social-publisher/social-publisher-page-client';
import { listUserCredentials } from '@/land/social/platform-credentials-store';
import { listUserDraftJobs, type StoredPublishJob } from '@/land/social/publish-job-store';
import type { ChannelCardData, ChannelHealthStatus } from '@/components/social-publisher/channel-credentials-grid';
import type { SocialPlatform } from '@/seed/types/social-publisher-types';

export default async function SocialPublisherPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/vi/login');
  }

  let dbCredentials: Awaited<ReturnType<typeof listUserCredentials>> = [];
  let drafts: StoredPublishJob[] = [];

  try {
    const [creds, userDrafts] = await Promise.all([
      listUserCredentials(user.id),
      listUserDraftJobs(user.id, 20),
    ]);
    dbCredentials = creds;
    drafts = userDrafts;
  } catch {
    dbCredentials = [];
    drafts = [];
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
      <SocialPublisherPageClient initialChannels={channels} initialDrafts={drafts} />
    </main>
  );
}
