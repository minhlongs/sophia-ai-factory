import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ExperimentVariant, ExperimentEvaluation } from './types';
import { simpleHash } from './hash-utils';

/**
 * Deterministically assign a variant to a user for the given experiment.
 * Returns null if the user is not enrolled based on traffic_pct.
 * If already assigned (same executionId), returns existing assignment.
 */
export async function assignVariant(params: {
  experimentId: string;
  userId: string;
  executionId?: string;
}): Promise<{ variantKey: string; variantValue: unknown } | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const { experimentId, userId, executionId } = params;

  const [existing, expRow] = await Promise.all([
    db.prepare(`SELECT variant_key FROM sop_experiment_assignments
       WHERE experiment_id = ?1 AND user_id = ?2 AND (execution_id = ?3 OR (execution_id IS NULL AND ?3 IS NULL))
       LIMIT 1`).bind(experimentId, userId, executionId ?? null).first<{ variant_key: string }>(),
    db.prepare(`SELECT variants_json, traffic_pct FROM sop_experiments WHERE id = ?1`)
      .bind(experimentId).first<{ variants_json: string; traffic_pct: number }>(),
  ]);

  if (!expRow) return null;
  const variants = JSON.parse(expRow.variants_json) as ExperimentVariant[];
  if (variants.length === 0) return null;

  if (existing) {
    const v = variants.find(item => item.key === existing.variant_key);
    return v ? { variantKey: v.key, variantValue: v.value } : null;
  }

  // Traffic enrollment check: hash(userId) mod 100 < trafficPct
  const enrollHash = simpleHash(userId + 'enroll') % 100;
  if (enrollHash >= expRow.traffic_pct) return null;

  // Deterministic variant selection
  const variantIdx = simpleHash(userId + experimentId) % variants.length;
  const chosen = variants[variantIdx];

  try {
    await db
      .prepare(
        `INSERT INTO sop_experiment_assignments
         (id, experiment_id, user_id, variant_key, execution_id, assigned_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(crypto.randomUUID(), experimentId, userId, chosen.key, executionId ?? null, Math.floor(Date.now() / 1000))
      .run();
  } catch (err) {
    logger.warn('[assignVariant] Insert failed (may be duplicate)', { error: getErrorMessage(err) });
  }

  return { variantKey: chosen.key, variantValue: chosen.value };
}

/** Record an outcome for an existing assignment. */
export async function recordOutcome(params: {
  experimentId: string;
  userId: string;
  executionId: string;
  outcomeJson: Record<string, unknown>;
}): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  try {
    await db
      .prepare(
        `UPDATE sop_experiment_assignments
         SET outcome_json = ?1, outcome_at = ?2
         WHERE experiment_id = ?3 AND user_id = ?4 AND execution_id = ?5`,
      )
      .bind(JSON.stringify(params.outcomeJson), Math.floor(Date.now() / 1000), params.experimentId, params.userId, params.executionId)
      .run();
  } catch (err) {
    logger.error('[recordOutcome] Update failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/** Aggregate assignment outcomes per variant for an experiment. */
export async function evaluateExperiment(experimentId: string): Promise<ExperimentEvaluation> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const { results } = await db
    .prepare(
      `SELECT variant_key, COUNT(*) as count,
              SUM(CASE WHEN outcome_json IS NOT NULL THEN 1 ELSE 0 END) as with_outcome,
              outcome_json
       FROM sop_experiment_assignments
       WHERE experiment_id = ?1
       GROUP BY variant_key`,
    )
    .bind(experimentId)
    .all<{ variant_key: string; count: number; with_outcome: number; outcome_json: string | null }>();

  // Compute avg quality_score per variant via a second query for accuracy
  const scoreRows = await db
    .prepare(
      `SELECT variant_key,
              AVG(CAST(json_extract(outcome_json, '$.quality_score') AS REAL)) as avg_quality_score
       FROM sop_experiment_assignments
       WHERE experiment_id = ?1 AND outcome_json IS NOT NULL
       GROUP BY variant_key`,
    )
    .bind(experimentId)
    .all<{ variant_key: string; avg_quality_score: number | null }>();

  const scoreMap = new Map(scoreRows.results.map(r => [r.variant_key, r.avg_quality_score]));

  return {
    experimentId,
    totalAssignments: results.reduce((s, r) => s + Number(r.count), 0),
    variantStats: results.map(r => ({
      variantKey: r.variant_key,
      count: Number(r.count),
      withOutcome: Number(r.with_outcome),
      avgQualityScore: scoreMap.get(r.variant_key) ?? null,
    })),
  };
}
