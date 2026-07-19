/**
 * /dashboard/social/history — Publish History page
 *
 * Server component: fetches publish_events for the current user.
 * Client component handles filtering, pagination, and CSV export.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { redirect } from 'next/navigation';
import HistoryClient from './history-client';

export const dynamic = 'force-dynamic';

export default async function SocialHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const db = getD1();
  let events: Array<{
    id: number;
    provider: string;
    content_title: string;
    scheduled_at: number;
    published_at: number | null;
    status: string;
    views: number;
    likes: number;
    shares: number;
    error_message: string | null;
  }> = [];

  if (db) {
    try {
      const r = await db
        .prepare(
          `SELECT id, provider, content_title, scheduled_at, published_at, status, views, likes, shares, error_message
           FROM publish_events
           WHERE user_id = ?
           ORDER BY scheduled_at DESC
           LIMIT 200`,
        )
        .bind(user.id)
        .all();
      events = (r.results ?? []) as typeof events;
    } catch {
      events = [];
    }
  }

  return (
    <HistoryClient
      userId={user.id}
      initialEvents={events}
    />
  );
}
