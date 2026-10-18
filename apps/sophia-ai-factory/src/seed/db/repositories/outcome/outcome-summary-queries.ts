/**
 * SOP and Creator Outcome Summary Aggregation Queries.
 * @module seed/db/repositories/outcome/outcome-summary-queries
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  type OutcomeMetricType,
  type OutcomeSummary,
  type CreatorSopOutcome,
  type AggRow,
  type CreatorAggRow,
} from './types';

function buildDateFilter(
  baseColumn: string,
  baseValue: string,
  opts: { fromDate?: number; toDate?: number },
): { where: string; bindings: unknown[]; nextIdx: number } {
  const conditions = [`${baseColumn} = ?1`];
  const bindings: unknown[] = [baseValue];
  let idx = 2;
  if (opts.fromDate !== undefined) {
    conditions.push(`recorded_at >= ?${idx++}`);
    bindings.push(opts.fromDate);
  }
  if (opts.toDate !== undefined) {
    conditions.push(`recorded_at <= ?${idx++}`);
    bindings.push(opts.toDate);
  }
  return { where: conditions.join(' AND '), bindings, nextIdx: idx };
}

/** Aggregate outcomes for a SOP, optionally filtered by date range. */
export async function getSOPOutcomeSummary(
  sopId: string,
  opts: { fromDate?: number; toDate?: number } = {},
): Promise<OutcomeSummary> {
  const empty: OutcomeSummary = {
    sopId,
    totalExecutions: 0,
    avgViews: 0,
    avgCtr: 0,
    totalRevenueCents: 0,
    avgEngagement: 0,
    period: { fromDate: opts.fromDate, toDate: opts.toDate },
  };
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const { where, bindings } = buildDateFilter('sop_id', sopId, opts);
    const result = await db
      .prepare(
        `SELECT metric_type, AVG(metric_value) AS avg_value, SUM(metric_value) AS total_value,
                COUNT(DISTINCT execution_id) AS execution_count
         FROM sop_execution_outcomes WHERE ${where} GROUP BY metric_type`,
      )
      .bind(...bindings)
      .all<AggRow>();

    const rows = result.results ?? [];
    const byType = Object.fromEntries(rows.map((r) => [r.metric_type, r]));
    return {
      ...empty,
      totalExecutions: rows[0]?.execution_count ?? 0,
      avgViews: byType['video_views']?.avg_value ?? 0,
      avgCtr: byType['click_through_rate']?.avg_value ?? 0,
      totalRevenueCents: byType['revenue_cents']?.total_value ?? 0,
      avgEngagement: byType['engagement_rate']?.avg_value ?? 0,
    };
  } catch (err) {
    logger.error('[OutcomeRepo] getSOPOutcomeSummary failed', { sopId, error: getErrorMessage(err) });
    return empty;
  }
}

/** Aggregate per-SOP outcomes for a creator, optionally filtered by date range. */
export async function getCreatorOutcomeSummary(
  userId: string,
  opts: { fromDate?: number; toDate?: number; limit?: number } = {},
): Promise<CreatorSopOutcome[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const { where, bindings, nextIdx } = buildDateFilter('user_id', userId, opts);
    bindings.push(opts.limit ?? 20);

    const result = await db
      .prepare(
        `SELECT sop_id, metric_type, AVG(metric_value) AS avg_value,
                COUNT(DISTINCT execution_id) AS execution_count
         FROM sop_execution_outcomes WHERE ${where}
         GROUP BY sop_id, metric_type ORDER BY execution_count DESC LIMIT ?${nextIdx}`,
      )
      .bind(...bindings)
      .all<CreatorAggRow>();

    const bySOp = new Map<string, CreatorSopOutcome>();
    for (const row of result.results ?? []) {
      if (!bySOp.has(row.sop_id)) {
        bySOp.set(row.sop_id, {
          sopId: row.sop_id,
          userId,
          executionCount: row.execution_count,
          metrics: {},
        });
      }
      const entry = bySOp.get(row.sop_id)!;
      entry.metrics[row.metric_type as OutcomeMetricType] = row.avg_value;
      entry.executionCount = Math.max(entry.executionCount, row.execution_count);
    }

    return Array.from(bySOp.values());
  } catch (err) {
    logger.error('[OutcomeRepo] getCreatorOutcomeSummary failed', { userId, error: getErrorMessage(err) });
    return [];
  }
}
