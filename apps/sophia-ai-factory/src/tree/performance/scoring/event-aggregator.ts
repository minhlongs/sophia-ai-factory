/**
 * Performance Event Aggregator for D1
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/scoring/event-aggregator
 */

import { getD1 } from '@/seed/db/client';
import { PerformanceError } from '../errors';
import type { PerformanceMetrics } from './types';
import { accumulateRetention, type RetentionAccumulator } from './retention-scorer';

export interface AggregationOptions {
  assetId?: string;
  workspaceId: string;
  channel?: string;
  windowStart: number;
  windowEnd: number;
}

export interface PerformanceEventRow {
  asset_id: string;
  channel: string | null;
  event_type: string;
  count: number;
  metrics_json: string;
  recorded_at: number;
}

interface EventTotals {
  impressions: number;
  views: number;
  clicks: number;
  likes: number;
  shares: number;
  saves: number;
  follows: number;
  conversions: number;
  revenueEvents: number;
}

const EVENT_COUNT_KEYS: Record<string, keyof EventTotals> = {
  impression: 'impressions',
  view: 'views',
  click: 'clicks',
  like: 'likes',
  share: 'shares',
  save: 'saves',
  follow: 'follows',
  conversion: 'conversions',
  revenue: 'revenueEvents',
};

function newEventTotals(): EventTotals {
  return {
    impressions: 0,
    views: 0,
    clicks: 0,
    likes: 0,
    shares: 0,
    saves: 0,
    follows: 0,
    conversions: 0,
    revenueEvents: 0,
  };
}

function buildAssetMetrics(key: string, assetRows: PerformanceEventRow[], workspaceId: string): PerformanceMetrics {
  const [assetId, channel] = key.split('|');
  const totals = newEventTotals();
  const retention: RetentionAccumulator = { r3sSum: 0, r30sSum: 0, count: 0 };

  for (const row of assetRows) {
    const totalKey = EVENT_COUNT_KEYS[row.event_type];
    if (totalKey) {
      totals[totalKey] += row.count;
    }
    accumulateRetention(row.metrics_json, retention);
  }

  const totalEngagements = totals.likes + totals.shares + totals.saves + totals.follows;
  const engagementDenominator = Math.max(totals.views, totals.impressions, 1);

  return {
    assetId,
    workspaceId,
    channel,
    impressions: totals.impressions,
    views: totals.views,
    clicks: totals.clicks,
    likes: totals.likes,
    shares: totals.shares,
    saves: totals.saves,
    follows: totals.follows,
    conversions: totals.conversions,
    revenueEvents: totals.revenueEvents,
    totalEngagements,
    engagementRate: totalEngagements / engagementDenominator,
    velocity: 0, // computed in computeScore
    retention3s: retention.count > 0 ? retention.r3sSum / retention.count : 0,
    retention30s: retention.count > 0 ? retention.r30sSum / retention.count : 0,
    windowStart: Math.min(...assetRows.map((r) => r.recorded_at)),
    windowEnd: Math.max(...assetRows.map((r) => r.recorded_at)),
    eventCount: assetRows.length,
  };
}

export async function aggregateMetricsFromEvents(
  opts: AggregationOptions,
): Promise<PerformanceMetrics[]> {
  const db = await getD1();
  if (!db) throw new PerformanceError('D1_UNAVAILABLE', 'D1 not available');

  const conditions = ['workspace_id = ?1', 'recorded_at >= ?2', 'recorded_at <= ?3'];
  const params: unknown[] = [opts.workspaceId, opts.windowStart, opts.windowEnd];
  let idx = 4;

  if (opts.assetId) {
    conditions.push(`asset_id = ?${idx}`);
    params.push(opts.assetId);
    idx++;
  }
  if (opts.channel) {
    conditions.push(`channel = ?${idx}`);
    params.push(opts.channel);
    idx++;
  }

  const where = conditions.join(' AND ');

  const result = await db
    .prepare(
      `SELECT
         asset_id,
         channel,
         event_type,
         count,
         metrics_json,
         recorded_at
       FROM performance_events
       WHERE ${where}
       ORDER BY recorded_at ASC`,
    )
    .bind(...params)
    .all<PerformanceEventRow>();

  const rows = result.results ?? [];
  if (rows.length === 0) {
    return [];
  }

  const byAssetChannel = new Map<string, PerformanceEventRow[]>();

  for (const row of rows) {
    const key = `${row.asset_id}|${row.channel ?? 'unknown'}`;
    if (!byAssetChannel.has(key)) byAssetChannel.set(key, []);
    byAssetChannel.get(key)!.push(row);
  }

  const metricsList: PerformanceMetrics[] = [];

  for (const [key, assetRows] of byAssetChannel) {
    metricsList.push(buildAssetMetrics(key, assetRows, opts.workspaceId));
  }

  return metricsList;
}
