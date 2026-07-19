/**
 * /dashboard/social/calendar — Publishing Calendar page
 *
 * Server component: fetches scheduled publish events for the current month.
 * Client component renders a responsive calendar grid (desktop) or list (mobile).
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { redirect } from 'next/navigation';
import CalendarClient from './calendar-client';

export const dynamic = 'force-dynamic';

export default async function SocialCalendarPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const db = getD1();
  let events: Array<{
    id: number;
    provider: string;
    content_title: string;
    scheduled_at: number;
    status: string;
    confidence?: number;
  }> = [];

  if (db) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const startSec = Math.floor(monthStart.getTime() / 1000);

      const r = await db
        .prepare(
          `SELECT id, provider, content_title, scheduled_at, status,
                  (SELECT confidence FROM rnn_schedule rs WHERE rs.channel = publish_events.provider ORDER BY created_at DESC LIMIT 1) as confidence
           FROM publish_events
           WHERE user_id = ? AND scheduled_at >= ?
           ORDER BY scheduled_at ASC`,
        )
        .bind(user.id, startSec)
        .all();
      events = (r.results ?? []) as typeof events;
    } catch {
      events = [];
    }
  }

  return (
    <CalendarClient
      userId={user.id}
      initialEvents={events.map((e) => ({
        ...e,
        confidence: e.confidence ?? 0,
      }))}
    />
  );
}
