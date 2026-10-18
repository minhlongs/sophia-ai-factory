/**
 * Video Analytics Store — D1 persistence for cross-platform performance snapshots
 * Provides querying, upserting, and rollup aggregations for Video Analytics Cockpit.
 * Layer: land/analytics | LOC: < 200 | Zero :any
 * @module land/analytics/video-analytics-store
 */

import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@/seed/db/client';
import type {
  VideoAnalyticsSnapshot,
  ChannelAggregateMetrics,
  AnalyticsQueryFilter,
} from '@/seed/types/video-analytics-types';
import {
  ANALYTICS_TABLE,
  INSERT_SNAPSHOT_SQL,
  AGGREGATE_METRICS_SQL,
  EMPTY_AGGREGATE_METRICS,
  mapAggregateRow,
  mapSnapshotRow,
  type AnalyticsSnapshotRow,
  type AggregateQueryRow,
} from './video-analytics-mapper';

export { ANALYTICS_TABLE, mapSnapshotRow, type AnalyticsSnapshotRow };

export async function upsertAnalyticsSnapshot(
  snapshot: Omit<VideoAnalyticsSnapshot, 'id' | 'createdAt'>,
  dbOverride?: D1Database,
): Promise<VideoAnalyticsSnapshot> {
  const db = dbOverride ?? (await getD1());
  if (!db) throw new Error('Database connection unavailable');

  const id = `vas_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();

  await db
    .prepare(INSERT_SNAPSHOT_SQL)
    .bind(
      id, snapshot.jobId, snapshot.userId, snapshot.channelId, snapshot.platform, snapshot.platformPostId,
      snapshot.title ?? null, snapshot.views, snapshot.watchTimeSeconds, snapshot.avgViewDurationSeconds,
      snapshot.avgViewPercentage, snapshot.threeSecViewRate, snapshot.completionRate,
      snapshot.likes, snapshot.comments, snapshot.shares, snapshot.saves,
      snapshot.hookScore, snapshot.retentionScore, snapshot.revenueUsd,
      snapshot.costMcu, snapshot.costUsd, snapshot.netRoiUsd,
      snapshot.banditStatus ?? 'COLD_START', snapshot.recordedAt, now,
    )
    .run();

  return { ...snapshot, id, createdAt: now };
}

export async function listUserAnalyticsSnapshots(
  userId: string,
  filter?: AnalyticsQueryFilter,
  dbOverride?: D1Database,
): Promise<VideoAnalyticsSnapshot[]> {
  const db = dbOverride ?? (await getD1());
  if (!db) return [];

  const clauses = ['user_id = ?'];
  const params: unknown[] = [userId];

  if (filter?.platform) {
    clauses.push('platform = ?');
    params.push(filter.platform);
  }
  if (filter?.channelId) {
    clauses.push('channel_id = ?');
    params.push(filter.channelId);
  }
  if (filter?.startDate) {
    clauses.push('recorded_at >= ?');
    params.push(filter.startDate);
  }
  if (filter?.endDate) {
    clauses.push('recorded_at <= ?');
    params.push(filter.endDate);
  }

  params.push(filter?.limit ?? 50, filter?.offset ?? 0);
  const query = `SELECT * FROM ${ANALYTICS_TABLE} WHERE ${clauses.join(' AND ')} ORDER BY recorded_at DESC LIMIT ? OFFSET ?`;
  const result = await db.prepare(query).bind(...params).all<AnalyticsSnapshotRow>();

  return (result.results ?? []).map(mapSnapshotRow);
}

export async function getUserAggregateMetrics(
  userId: string,
  dbOverride?: D1Database,
): Promise<ChannelAggregateMetrics> {
  const db = dbOverride ?? (await getD1());
  if (!db) return EMPTY_AGGREGATE_METRICS;

  const row = await db
    .prepare(AGGREGATE_METRICS_SQL)
    .bind(userId)
    .first<AggregateQueryRow>();

  return mapAggregateRow(row);
}
