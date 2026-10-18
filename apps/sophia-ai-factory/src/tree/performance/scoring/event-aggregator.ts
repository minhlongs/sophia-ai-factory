/**
 * Performance Event Aggregator for D1
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/scoring/event-aggregator
 */

import { getD1 } from '@/seed/db/client';
import { PerformanceError } from '../errors';
import type { PerformanceMetrics } from './types';
import {
  buildAssetMetrics,
  type PerformanceEventRow,
} from './asset-metrics-builder';

export type { PerformanceEventRow };

export interface AggregationOptions {
  assetId?: string;
  workspaceId: string;
  channel?: string;
  windowStart: number;
  windowEnd: number;
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
