/**
 * solo-orchestrator-feedback-evaluator.ts — Metric fetcher, deduplicator, and threshold evaluator.
 * Layer: tree (domain-reusable, imports seed only)
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { FeedbackSignal } from '@/seed/types/solo-company-types';
import type { ThresholdConfig } from './solo-orchestrator-feedback';

export interface MetricRow {
  metric: string;
  value: number;
}

/**
 * Fetch latest metric values from D1 daily_metrics table.
 * Returns empty array if table doesn't exist (graceful fallback).
 */
export async function fetchMetrics(userId: string): Promise<MetricRow[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = await db
      .prepare(
        `SELECT metric, value FROM daily_metrics
         WHERE user_id = ? AND created_at > ?
         ORDER BY created_at DESC LIMIT 50`,
      )
      .bind(userId, since)
      .all<MetricRow>();
    return result.results ?? [];
  } catch (err) {
    const msg = getErrorMessage(err);
    if (msg.includes('no such table') || msg.includes('SQLITE_ERROR')) {
      logger.debug('solo-orchestrator-feedback: daily_metrics table not found, skipping');
      return [];
    }
    logger.error('solo-orchestrator-feedback: fetchMetrics failed', { error: msg });
    return [];
  }
}

/**
 * Deduplicate: keep only the most recent value per metric name.
 */
export function dedupeMetrics(rows: MetricRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!map.has(row.metric)) {
      map.set(row.metric, row.value);
    }
  }
  return map;
}

export function evaluateThreshold(
  metric: string,
  value: number,
  threshold: ThresholdConfig,
): FeedbackSignal | null {
  if (threshold.minValue !== undefined && value < threshold.minValue) {
    return {
      metric,
      currentValue: value,
      threshold: threshold.minValue,
      direction: 'below',
      suggestedAction: threshold.action,
    };
  }
  if (threshold.maxValue !== undefined && value > threshold.maxValue) {
    return {
      metric,
      currentValue: value,
      threshold: threshold.maxValue,
      direction: 'above',
      suggestedAction: threshold.action,
    };
  }
  return null;
}
