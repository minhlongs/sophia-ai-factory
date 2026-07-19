/**
 * GET /api/social/channels — list user's connected social channels
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getD1();
  if (!db) {
    return NextResponse.json({ channels: [] });
  }

  let channels: Array<{
    provider: string;
    display_name: string | null;
    status: string;
    followers_count: number;
    last_published_at: number | null;
    total_posts: number;
  }> = [];

  try {
    const all = await db.prepare(`SELECT provider, display_name, status, followers_count, last_published_at,
      (SELECT COUNT(*) FROM publish_events WHERE provider = sc.provider AND user_id = sc.user_id) as total_posts
      FROM social_channels sc WHERE user_id = ? ORDER BY provider ASC`).bind(user.id).all();
    channels = (all.results ?? []) as typeof channels;
  } catch {
    try {
      const all = await db.prepare(`SELECT DISTINCT provider, display_name, status,
        (SELECT COUNT(*) FROM publishing_jobs WHERE channel_id = pc.id AND status = 'live') as total_posts,
        NULL as followers_count, NULL as last_published_at
        FROM publishing_channels pc WHERE user_id = ? ORDER BY provider ASC`).bind(user.id).all();
      channels = (all.results ?? []) as typeof channels;
    } catch {
      channels = [];
    }
  }

  return NextResponse.json({ channels });
}
