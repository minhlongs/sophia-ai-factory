/**
 * Outcome Tracking Repository Write Operations
 *
 * Layer: seed (Foundational primitives)
 * @module seed/db/repositories/outcome/outcome-tracking-repository
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { OutcomeMetricType } from './types';

/** Insert a single outcome metric. Returns generated ID. Throws on D1 error. */
export async function recordOutcome(params: {
  executionId: string;
  sopId: string;
  userId: string;
  metricType: OutcomeMetricType;
  metricValue: number;
  source?: string;
}): Promise<string> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO sop_execution_outcomes
         (id, execution_id, sop_id, user_id, metric_type, metric_value, source, recorded_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      id,
      params.executionId,
      params.sopId,
      params.userId,
      params.metricType,
      params.metricValue,
      params.source ?? null,
      now,
    )
    .run();

  logger.info('[OutcomeRepo] Outcome recorded', {
    id,
    executionId: params.executionId,
    metricType: params.metricType,
  });
  return id;
}

/** Batch-insert multiple outcomes for one execution. Returns array of generated IDs. */
export async function recordBatchOutcomes(
  outcomes: Array<{
    executionId: string;
    sopId: string;
    userId: string;
    metricType: OutcomeMetricType;
    metricValue: number;
    source?: string;
  }>,
): Promise<string[]> {
  if (outcomes.length === 0) return [];

  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const now = Math.floor(Date.now() / 1000);
  const ids: string[] = [];

  const stmts = outcomes.map((o) => {
    const id = crypto.randomUUID();
    ids.push(id);
    return db
      .prepare(
        `INSERT INTO sop_execution_outcomes
           (id, execution_id, sop_id, user_id, metric_type, metric_value, source, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(id, o.executionId, o.sopId, o.userId, o.metricType, o.metricValue, o.source ?? null, now);
  });

  await db.batch(stmts);
  logger.info('[OutcomeRepo] Batch outcomes recorded', { count: ids.length, executionId: outcomes[0]?.executionId });
  return ids;
}
