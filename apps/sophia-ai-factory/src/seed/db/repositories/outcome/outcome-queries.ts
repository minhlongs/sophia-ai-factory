/**
 * Outcome Query and Aggregation Operations
 *
 * Layer: seed (Foundational primitives)
 * @module seed/db/repositories/outcome/outcome-queries
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  type OutcomeMetric,
  type RawOutcomeRow,
  mapRow,
} from './types';

export {
  getSOPOutcomeSummary,
  getCreatorOutcomeSummary,
} from './outcome-summary-queries';

/** Fetch all outcome rows for a given execution. Returns empty array on error. */
export async function getExecutionOutcomes(executionId: string): Promise<OutcomeMetric[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const result = await db
      .prepare(
        `SELECT id, execution_id, sop_id, user_id, metric_type, metric_value, source, recorded_at
         FROM sop_execution_outcomes
         WHERE execution_id = ?1
         ORDER BY recorded_at ASC`,
      )
      .bind(executionId)
      .all<RawOutcomeRow>();

    return (result.results ?? []).map(mapRow);
  } catch (err) {
    logger.error('[OutcomeRepo] getExecutionOutcomes failed', { executionId, error: getErrorMessage(err) });
    return [];
  }
}

/** Fetch recent outcome rows for a user. Returns [] on error. */
export async function getRecentOutcomes(userId: string, limit = 20): Promise<OutcomeMetric[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const result = await db
      .prepare(
        `SELECT id, execution_id, sop_id, user_id, metric_type, metric_value, source, recorded_at
         FROM sop_execution_outcomes
         WHERE user_id = ?1
         ORDER BY recorded_at DESC LIMIT ?2`,
      )
      .bind(userId, limit)
      .all<RawOutcomeRow>();
    return (result.results ?? []).map(mapRow);
  } catch (err) {
    logger.error('[OutcomeRepo] getRecentOutcomes failed', { userId, error: getErrorMessage(err) });
    return [];
  }
}

/** Top SOPs by total revenue for a user. Returns [{sopId, totalRevenue}]. */
export async function getTopSopsByRevenue(
  userId: string,
  limit = 5,
): Promise<Array<{ sopId: string; totalRevenue: number }>> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const result = await db
      .prepare(
        `SELECT sop_id, SUM(metric_value) AS total_revenue
         FROM sop_execution_outcomes
         WHERE user_id = ?1 AND metric_type = 'revenue_cents'
         GROUP BY sop_id
         ORDER BY total_revenue DESC
         LIMIT ?2`,
      )
      .bind(userId, limit)
      .all<{ sop_id: string; total_revenue: number }>();
    return (result.results ?? []).map((r) => ({ sopId: r.sop_id, totalRevenue: r.total_revenue }));
  } catch (err) {
    logger.error('[OutcomeRepo] getTopSopsByRevenue failed', { userId, error: getErrorMessage(err) });
    return [];
  }
}
