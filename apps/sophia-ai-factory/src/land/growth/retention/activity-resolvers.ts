/**
 * Customer Activity & Job Telemetry Resolvers.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/activity-resolvers
 */

import { getD1 } from '@/seed/db/client';

type D1Client = ReturnType<typeof getD1> extends Promise<infer T> ? T : never;

interface D1SessionRow {
  updatedAt: string | null;
  createdAt: string | null;
}

interface D1StreakRow {
  last_activity_date: string | null;
  updated_at: number | null;
}

interface D1JobStatusRow {
  status: string;
  cnt: number;
}

export async function resolveLastActiveTimestamp(
  db: D1Client,
  userId: string,
  userCreatedAt: string | null,
): Promise<number | null> {
  let lastActiveMs: number | null = null;
  if (!db) return null;

  try {
    const sessionRow = await db
      .prepare(
        'SELECT updatedAt, createdAt FROM "session" WHERE userId = ? ORDER BY createdAt DESC LIMIT 1',
      )
      .bind(userId)
      .first<D1SessionRow>();

    if (sessionRow?.updatedAt) {
      lastActiveMs = new Date(sessionRow.updatedAt).getTime();
    } else if (sessionRow?.createdAt) {
      lastActiveMs = new Date(sessionRow.createdAt).getTime();
    }
  } catch {
    // Non-fatal
  }

  try {
    const streakRow = await db
      .prepare(
        'SELECT last_activity_date, updated_at FROM user_streaks WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
      )
      .bind(userId)
      .first<D1StreakRow>();

    if (streakRow?.last_activity_date) {
      const streakTime = new Date(streakRow.last_activity_date).getTime();
      if (
        !Number.isNaN(streakTime) &&
        (!lastActiveMs || streakTime > lastActiveMs)
      ) {
        lastActiveMs = streakTime;
      }
    }
  } catch {
    // Non-fatal
  }

  if (!lastActiveMs && userCreatedAt) {
    lastActiveMs = new Date(userCreatedAt).getTime();
  }

  return lastActiveMs;
}

export async function resolveRenderJobCounts(
  db: D1Client,
  userId: string,
): Promise<{ completedJobs: number; failedJobs: number }> {
  let completedJobs = 0;
  let failedJobs = 0;
  if (!db) return { completedJobs, failedJobs };

  try {
    const videoJobsRows = await db
      .prepare(
        'SELECT status, COUNT(*) as cnt FROM video_jobs WHERE user_id = ? GROUP BY status',
      )
      .bind(userId)
      .all<D1JobStatusRow>();

    if (videoJobsRows.results && videoJobsRows.results.length > 0) {
      for (const row of videoJobsRows.results) {
        if (
          row.status === 'published' ||
          row.status === 'uploaded' ||
          row.status === 'completed'
        ) {
          completedJobs += row.cnt;
        } else if (row.status === 'failed') {
          failedJobs += row.cnt;
        }
      }
    }
  } catch {
    // Non-fatal fallback
  }

  if (completedJobs === 0 && failedJobs === 0) {
    try {
      const videosRows = await db
        .prepare(
          'SELECT status, COUNT(*) as cnt FROM videos WHERE user_id = ? GROUP BY status',
        )
        .bind(userId)
        .all<D1JobStatusRow>();

      if (videosRows.results) {
        for (const row of videosRows.results) {
          if (row.status === 'completed') completedJobs += row.cnt;
          if (row.status === 'failed') failedJobs += row.cnt;
        }
      }
    } catch {
      // Non-fatal
    }
  }

  return { completedJobs, failedJobs };
}
