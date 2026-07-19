/**
 * /dashboard/social/channels — Social Channels page
 *
 * Server component: fetches connected channels from social_channels table
 * (or falls back to publishing_channels for connected OAuth channels).
 * Client component handles connect/disconnect via OAuth redirect.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { redirect } from 'next/navigation';
import ChannelsClient from './channels-client';

export const dynamic = 'force-dynamic';

export default async function SocialChannelsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Fetch connected channels from both tables (primary: social_channels, fallback: publishing_channels)
  const db = getD1();
  let channels: Array<{
    provider: string;
    display_name: string | null;
    status: string;
    followers_count: number;
    last_published_at: number | null;
    total_posts: number;
    avg_engagement: number | null;
  }> = [];

  if (db) {
    try {
      // Primary: social_channels table (Phase 4)
      const r = await db
        .prepare(
          `SELECT provider, display_name, status, followers_count, last_published_at,
                  (SELECT COUNT(*) FROM publish_events WHERE provider = social_channels.provider AND user_id = social_channels.user_id) as total_posts,
                  NULL as avg_engagement
           FROM social_channels WHERE user_id = ?`,
        )
        .bind(user.id)
        .all();
      channels = (r.results ?? []) as typeof channels;
    } catch {
      // Table doesn't exist yet — try publishing_channels fallback
      try {
        const r = await db
          .prepare(
            `SELECT DISTINCT provider, display_name, status,
                    (SELECT COUNT(*) FROM publishing_jobs WHERE channel_id = pc.id AND status = 'live') as total_posts,
                    NULL as followers_count, NULL as last_published_at, NULL as avg_engagement
             FROM publishing_channels pc WHERE pc.user_id = ?`,
          )
          .bind(user.id)
          .all();
        channels = (r.results ?? []) as typeof channels;
      } catch {
        channels = [];
      }
    }
  }

  return (
    <ChannelsClient
      userId={user.id}
      initialChannels={channels.map((c) => ({
        ...c,
        avg_engagement: c.avg_engagement ?? null,
      }))}
    />
  );
}
