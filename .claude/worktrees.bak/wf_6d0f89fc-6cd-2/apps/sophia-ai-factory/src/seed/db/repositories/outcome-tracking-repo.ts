/**
 * Outcome Tracking repository — CRUD for `sop_execution_outcomes` table.
 * Records per-metric outcome rows after SOP executions and aggregates them.
 * @module seed/db/repositories/outcome-tracking-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type {
  OutcomeMetric,
  OutcomeMetricType,
  OutcomeSummary,
  CreatorSopOutcome,
} from '@/seed/types/outcome';

// ── Raw DB row type ───────────────────────────────────────────────────────────

interface RawOutcomeRow {
  id: string;
  execution_id: string;
  sop_id: string;
  user_id: string;
  metric_type: string;
  metric_value: number;
  source: string | null;
  recorded_at: number;
}

function mapRow(r: RawOutcomeRow): OutcomeMetric {
  return {
    id: r.id,
    executionId: r.execution_id,
    sopId: r.sop_id,
    userId: r.user_id,
    metricType: r.metric_type as OutcomeMetricType,
    metricValue: r.metric_value,
    source: r.source ?? undefined,
    recordedAt: r.recorded_at,
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Insert a single outcome metric. Returns generated ID. Throws on D1 error. */
export async function recordOutcome(params: {
  executionId: string;
  sopId: string;
  userId: string;
  metricType: OutcomeMetricType;
  metricValue: number;
  source?: string;
}): Promise<string> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
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

  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
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

// ── Read ──────────────────────────────────────────────────────────────────────

/** Fetch all outcome rows for a given execution. Returns empty array on error. */
export async function getExecutionOutcomes(executionId: string): Promise<OutcomeMetric[]> {
  try {
    const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
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
    const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
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
    const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
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

// ── Aggregates ────────────────────────────────────────────────────────────────

interface AggRow {
  metric_type: string;
  avg_value: number;
  total_value: number;
  execution_count: number;
}

/** Aggregate outcomes for a SOP, optionally filtered by date range. */
export async function getSOPOutcomeSummary(
  sopId: string,
  opts: { fromDate?: number; toDate?: number } = {},
): Promise<OutcomeSummary> {
  try {
    const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
    const conditions = ['sop_id = ?1'];
    const bindings: unknown[] = [sopId];
    let idx = 2;

    if (opts.fromDate !== undefined) { conditions.push(`recorded_at >= ?${idx++}`); bindings.push(opts.fromDate); }
    if (opts.toDate   !== undefined) { conditions.push(`recorded_at <= ?${idx++}`); bindings.push(opts.toDate); }

    const where = conditions.join(' AND ');
    const result = await db
      .prepare(
        `SELECT metric_type,
                AVG(metric_value) AS avg_value,
                SUM(metric_value) AS total_value,
                COUNT(DISTINCT execution_id) AS execution_count
         FROM sop_execution_outcomes
         WHERE ${where}
         GROUP BY metric_type`,
      )
      .bind(...bindings)
      .all<AggRow>();

    const rows = result.results ?? [];
    const byType = Object.fromEntries(rows.map((r) => [r.metric_type, r]));

    const totalExecutions = rows[0]?.execution_count ?? 0;

    return {
      sopId,
      totalExecutions,
      avgViews:          byType['video_views']?.avg_value        ?? 0,
      avgCtr:            byType['click_through_rate']?.avg_value ?? 0,
      totalRevenueCents: byType['revenue_cents']?.total_value    ?? 0,
      avgEngagement:     byType['engagement_rate']?.avg_value    ?? 0,
      period: { fromDate: opts.fromDate, toDate: opts.toDate },
    };
  } catch (err) {
    logger.error('[OutcomeRepo] getSOPOutcomeSummary failed', { sopId, error: getErrorMessage(err) });
    return {
      sopId,
      totalExecutions: 0,
      avgViews: 0,
      avgCtr: 0,
      totalRevenueCents: 0,
      avgEngagement: 0,
      period: { fromDate: opts.fromDate, toDate: opts.toDate },
    };
  }
}

interface CreatorAggRow {
  sop_id: string;
  metric_type: string;
  avg_value: number;
  execution_count: number;
}

/** Aggregate per-SOP outcomes for a creator, optionally filtered by date range. */
export async function getCreatorOutcomeSummary(
  userId: string,
  opts: { fromDate?: number; toDate?: number; limit?: number } = {},
): Promise<CreatorSopOutcome[]> {
  try {
    const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
    const conditions = ['user_id = ?1'];
    const bindings: unknown[] = [userId];
    let idx = 2;

    if (opts.fromDate !== undefined) { conditions.push(`recorded_at >= ?${idx++}`); bindings.push(opts.fromDate); }
    if (opts.toDate   !== undefined) { conditions.push(`recorded_at <= ?${idx++}`); bindings.push(opts.toDate); }
    bindings.push(opts.limit ?? 20);

    const where = conditions.join(' AND ');
    const result = await db
      .prepare(
        `SELECT sop_id, metric_type,
                AVG(metric_value) AS avg_value,
                COUNT(DISTINCT execution_id) AS execution_count
         FROM sop_execution_outcomes
         WHERE ${where}
         GROUP BY sop_id, metric_type
         ORDER BY execution_count DESC
         LIMIT ?${idx}`,
      )
      .bind(...bindings)
      .all<CreatorAggRow>();

    // Group by sop_id
    const bySOp = new Map<string, CreatorSopOutcome>();
    for (const row of result.results ?? []) {
      if (!bySOp.has(row.sop_id)) {
        bySOp.set(row.sop_id, { sopId: row.sop_id, userId, executionCount: row.execution_count, metrics: {} });
      }
      const entry = bySOp.get(row.sop_id)!;
      entry.metrics[row.metric_type as OutcomeMetricType] = row.avg_value;
      // execution_count is same across metric_type groups for a sop_id
      entry.executionCount = Math.max(entry.executionCount, row.execution_count);
    }

    return Array.from(bySOp.values());
  } catch (err) {
    logger.error('[OutcomeRepo] getCreatorOutcomeSummary failed', { userId, error: getErrorMessage(err) });
    return [];
  }
}
