import { createServerClient } from '@/seed/db/client';
import {
  listQueuedForRetry,
  type VideoRow,
} from '@/seed/db/repositories/videos-repo';
import { MAX_ATTEMPTS, isRetryDue } from '@/land/fulfillment/retry-backoff';
import { BATCH_LIMIT, type UserEmailRow } from './types';

/**
 * Fetch basic user email and locale for notifications.
 */
export async function fetchUserEmail(userId: string): Promise<{ email: string; locale: string } | null> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('user')
      .select('email, locale')
      .eq('id', userId)
      .single();
    const row = data as UserEmailRow | null;
    if (!row?.email) return null;
    return { email: row.email, locale: row.locale ?? 'vi' };
  } catch {
    return null;
  }
}

/**
 * Retrieves eligible queued videos due for retry attempt.
 */
export async function findDueRetryVideos(now: number): Promise<{
  rows: VideoRow[];
  dueRows: VideoRow[];
  skippedCount: number;
}> {
  const rows = await listQueuedForRetry(MAX_ATTEMPTS, BATCH_LIMIT);
  const dueRows = rows.filter((row) =>
    isRetryDue(row.attempt_count, row.last_attempt_at, now),
  );
  return {
    rows,
    dueRows,
    skippedCount: rows.length - dueRows.length,
  };
}
