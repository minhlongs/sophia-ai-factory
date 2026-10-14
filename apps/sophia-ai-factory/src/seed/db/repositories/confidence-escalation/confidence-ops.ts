import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ConfidenceFactors, ConfidenceScore } from '@/seed/types/confidence';
import type { RawConfidenceRow } from './types';
import { mapConfidence } from './types';

/** Insert a confidence score for a step. Throws on D1 error. */
export async function logConfidence(params: {
  executionId: string;
  stepIndex: number;
  score: number;
  factors: ConfidenceFactors;
}): Promise<string> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO sop_step_confidence (id, execution_id, step_index, score, factors_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(
      id,
      params.executionId,
      params.stepIndex,
      params.score,
      JSON.stringify(params.factors),
      now,
    )
    .run();

  logger.info('[ConfidenceRepo] Confidence logged', {
    id,
    executionId: params.executionId,
    stepIndex: params.stepIndex,
    score: params.score,
  });
  return id;
}

/** Fetch all confidence scores for an execution. Returns [] on error. */
export async function getConfidenceForExecution(
  executionId: string,
): Promise<ConfidenceScore[]> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const result = await db
      .prepare(
        `SELECT id, execution_id, step_index, score, factors_json, created_at
         FROM sop_step_confidence WHERE execution_id = ?1 ORDER BY step_index ASC`,
      )
      .bind(executionId)
      .all<RawConfidenceRow>();
    return (result.results ?? []).map(mapConfidence);
  } catch (err) {
    logger.error('[ConfidenceRepo] getConfidenceForExecution failed', {
      executionId,
      error: getErrorMessage(err),
    });
    return [];
  }
}

/** Fetch recent confidence scores across all executions. Returns [] on error. */
export async function getRecentScores(limit = 50): Promise<ConfidenceScore[]> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const result = await db
      .prepare(
        `SELECT id, execution_id, step_index, score, factors_json, created_at
         FROM sop_step_confidence ORDER BY created_at DESC LIMIT ?1`,
      )
      .bind(limit)
      .all<RawConfidenceRow>();
    return (result.results ?? []).map(mapConfidence);
  } catch (err) {
    logger.error('[ConfidenceRepo] getRecentScores failed', {
      error: getErrorMessage(err),
    });
    return [];
  }
}
