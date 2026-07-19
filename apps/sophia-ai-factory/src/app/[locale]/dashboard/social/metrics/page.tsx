/**
 * /dashboard/social/metrics — Social Metrics page
 *
 * Server component: fetches aggregated metrics from engagement_metrics.
 * Client component renders Recharts line chart and summary cards.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { redirect } from 'next/navigation';
import MetricsClient from './metrics-client';

export const dynamic = 'force-dynamic';

export default async function SocialMetricsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const db = getD1();
  const channels: string[] = [];
  const rawData: Array<{
    day: string;
    channel: string;
    views: number;
    likes: number;
    shares: number;
  }> = [];

  if (db) {
    try {
      const { data: chRows } = await db
        .prepare('SELECT DISTINCT channel FROM engagement_metrics WHERE channel IS NOT NULL')
        .all<{ channel: string }>();
      channels.push(...(chRows ?? []).map((r) => r.channel));

      const toSec = Math.floor(Date.now() / 1000);
      const fromSec = toSec - 90 * 86400;

      const { data } = await db
        .prepare(
          `SELECT
            strftime('%Y-%m-%d', datetime(collected_at, 'unixepoch')) as day,
            channel,
            SUM(views) as views,
            SUM(likes) as likes,
            SUM(shares) as shares
           FROM engagement_metrics
           WHERE collected_at >= ? AND collected_at <= ?
           GROUP BY day, channel
           ORDER BY day ASC`,
        )
        .bind(fromSec, toSec)
        .all<{ day: string; channel: string; views: number; likes: number; shares: number }>();
      rawData.push(...(data ?? []));
    } catch {
      // Table not yet populated — pass empty data to client
    }
  }

  return (
    <MetricsClient
      userId={user.id}
      channels={channels}
      rawData={rawData}
    />
  );
}
