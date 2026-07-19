/**
 * GET /api/social/metrics
 *
 * Query engagement metrics for the current user across connected channels.
 * Returns time-series data suitable for line charts in the metrics page.
 *
 * Query params:
 *   channel   — optional filter (youtube|tiktok|instagram|facebook|telegram)
 *   dateRange — optional "from" ISO date (defaults to 30 days ago)
 *   groupBy   — "day" (default) or "hour"
 *
 * Auth: session cookie required.
 *
 * @module app/api/social/metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  channel: z
    .enum(['youtube', 'tiktok', 'instagram', 'facebook', 'telegram'])
    .optional(),
  dateRange: z.string().optional(),
  groupBy: z.enum(['day', 'hour']).default('day').optional(),
});

/**
 * Build date-series rows between fromSec and toSec,
 * zero-filled for channels with no data.
 */
function buildDateSeries(
  fromSec: number,
  toSec: number,
  groupBy: 'day' | 'hour',
): Array<{ date: string; bucket: number }> {
  const rows: Array<{ date: string; bucket: number }> = [];
  const step = groupBy === 'hour' ? 3600 : 86400;
  for (let ts = fromSec; ts <= toSec; ts += step) {
    const d = new Date(ts * 1000);
    if (groupBy === 'hour') {
      rows.push({ date: d.toISOString().slice(0, 13), bucket: ts });
    } else {
      rows.push({ date: d.toISOString().slice(0, 10), bucket: ts });
    }
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const raw = {
    channel: url.searchParams.get('channel') ?? undefined,
    dateRange: url.searchParams.get('dateRange') ?? undefined,
    groupBy: url.searchParams.get('groupBy') ?? 'day',
  };

  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_QUERY', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { channel, dateRange, groupBy } = parsed.data;

  const db = getD1();
  if (!db) {
    return NextResponse.json(
      { error: 'DB_UNAVAILABLE' },
      { status: 503 },
    );
  }

  // Default: last 30 days
  const toSec = Math.floor(Date.now() / 1000);
  let fromSec: number;
  if (dateRange) {
    const parts = dateRange.split(',');
    if (parts.length === 2 && parts[0]) {
      fromSec = Math.floor(new Date(parts[0]).getTime() / 1000);
    } else {
      fromSec = toSec - 30 * 86400;
    }
  } else {
    fromSec = toSec - 30 * 86400;
  }

  // Build channel list from our engagement_metrics table
  let channelList: string[];
  try {
    const chResult = await db
      .prepare(
        'SELECT DISTINCT channel FROM engagement_metrics WHERE channel IS NOT NULL',
      )
      .all<{ channel: string }>();
    channelList = (chResult.results ?? []).map((r: { channel: string }) => r.channel);
  } catch {
    channelList = [];
  }

  if (channel) {
    channelList = channelList.filter((c) => c === channel);
  }

  const result: Array<{
    date: string;
    channel: string;
    views: number;
    likes: number;
    shares: number;
    engagementRate: number;
  }> = [];

  for (const ch of channelList) {
    try {
      const r = await db
        .prepare(
          `SELECT
            strftime('%Y-%m-%d', datetime(collected_at, 'unixepoch')) as day,
            SUM(views) as views,
            SUM(likes) as likes,
            SUM(shares) as shares
           FROM engagement_metrics
           WHERE channel = ? AND collected_at >= ? AND collected_at <= ?
           GROUP BY day
           ORDER BY day ASC`,
        )
        .bind(ch, fromSec, toSec)
        .all<{ day: string; views: number; likes: number; shares: number }>();

      for (const row of data ?? []) {
        const views = row.views ?? 0;
        const likes = row.likes ?? 0;
        const shares = row.shares ?? 0;
        const engagementRate =
          views > 0 ? ((likes + shares) / views) * 100 : 0;
        result.push({
          date: row.day,
          channel: ch,
          views,
          likes,
          shares,
          engagementRate: Math.round(engagementRate * 10) / 10,
        });
      }
    } catch {
      // Skip channels that error
    }
  }

  // Zero-fill and pivot
  const series = buildDateSeries(fromSec, toSec, groupBy ?? 'day');
  const pivot = new Map<string, Record<string, string | number>>();
  for (const row of result) {
    if (!pivot.has(row.date)) pivot.set(row.date, { date: row.date });
    const entry = pivot.get(row.date)!;
    entry[row.channel] = row.engagementRate;
  }
  const rows = series.map(({ date }) => {
    const entry = pivot.get(date) ?? { date };
    return entry;
  });

  return NextResponse.json({
    channels: channelList,
    dateRange: { from: new Date(fromSec * 1000).toISOString(), to: new Date(toSec * 1000).toISOString() },
    rows,
  });
}
