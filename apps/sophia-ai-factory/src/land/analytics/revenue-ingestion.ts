/**
 * YouTube revenue ingestion — writes normalized YouTube Analytics revenue
 * into performance_events as event_type='revenue' (workspace-scoped).
 *
 * Idempotency: deterministic event id `rev_{userId}_{videoId}_{date}` +
 * INSERT OR IGNORE on the id PK — the 12h cron re-fetches a 30-day window,
 * so re-runs must not duplicate rows. No new tables or migrations.
 *
 * Never throws: a revenue-write failure must not break the analytics sync.
 *
 * @module land/analytics/revenue-ingestion
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { recordPerformanceEventIdempotent } from '@/tree/performance/events';

export interface RevenueRowInput {
  videoId: string;
  date: string; // YYYY-MM-DD
  estimatedRevenueCents: number;
}

interface WriteResult {
  written: number;
  skipped: number;
}

interface OrgMemberRow {
  org_id: string;
}

/**
 * Resolve the user's workspace from org_members (first membership).
 * Returns null when the user has no org membership.
 */
async function resolveWorkspaceId(userId: string): Promise<string | null> {
  const db = await getD1();
  if (!db) return null;
  const row = await db
    .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<OrgMemberRow>();
  return row?.org_id ?? null;
}

/** UTC midnight of a YYYY-MM-DD date as epoch milliseconds. */
function utcMidnightMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

/**
 * Write one revenue event per (video, date) row with positive revenue.
 * Zero-cent rows are skipped (majority of video-days earn nothing —
 * they would only add noise rows).
 */
export async function writeYouTubeRevenueEvents(input: {
  userId: string;
  rows: RevenueRowInput[];
}): Promise<WriteResult> {
  const { userId, rows } = input;
  if (rows.length === 0) return { written: 0, skipped: 0 };

  const workspaceId = await resolveWorkspaceId(userId);
  if (!workspaceId) {
    logger.warn('[revenue-ingestion] No workspace for user — skipping revenue write', {
      userId,
      rowCount: rows.length,
    });
    return { written: 0, skipped: rows.length };
  }

  let written = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.estimatedRevenueCents <= 0) {
      skipped++;
      continue;
    }

    const inserted = await recordPerformanceEventIdempotent({
      id: `rev_${userId}_${row.videoId}_${row.date}`,
      workspaceId,
      assetId: row.videoId,
      projectId: row.videoId,
      entityType: 'video',
      entityId: row.videoId,
      channel: 'youtube',
      eventType: 'revenue',
      count: 1,
      valueCents: row.estimatedRevenueCents,
      recordedAt: utcMidnightMs(row.date),
      rawData: { source: 'youtube-analytics', date: row.date },
    });

    if (inserted) written++;
    else skipped++;
  }

  return { written, skipped };
}
