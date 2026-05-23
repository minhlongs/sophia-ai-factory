/**
 * Repository for confidence scores and escalation requests.
 * Tables: sop_step_confidence, escalation_requests.
 * @module seed/db/repositories/confidence-escalation-repo
 */

import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ConfidenceFactors, ConfidenceScore, EscalationRequest, EscalationStatus } from '@/seed/types/confidence';

// ── Raw row types ─────────────────────────────────────────────────────────────

interface RawConfidenceRow {
  id: string;
  execution_id: string;
  step_index: number;
  score: number;
  factors_json: string | null;
  created_at: number;
}

interface RawEscalationRow {
  id: string;
  execution_id: string;
  step_index: number;
  reason: string;
  status: string;
  resolved_by: string | null;
  resolved_at: number | null;
  created_at: number;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapConfidence(r: RawConfidenceRow): ConfidenceScore {
  return {
    id: r.id,
    executionId: r.execution_id,
    stepIndex: r.step_index,
    score: r.score,
    factors: r.factors_json
      ? (JSON.parse(r.factors_json) as ConfidenceFactors)
      : { outputLength: 0, errorRate: 0, latencyRatio: 0, toolReliability: 0 },
    createdAt: r.created_at,
  };
}

function mapEscalation(r: RawEscalationRow): EscalationRequest {
  return {
    id: r.id,
    executionId: r.execution_id,
    stepIndex: r.step_index,
    reason: r.reason,
    status: r.status as EscalationStatus,
    resolvedBy: r.resolved_by ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    createdAt: r.created_at,
  };
}

// ── Confidence CRUD ───────────────────────────────────────────────────────────

/** Insert a confidence score for a step. Throws on D1 error. */
export async function logConfidence(params: {
  executionId: string;
  stepIndex: number;
  score: number;
  factors: ConfidenceFactors;
}): Promise<string> {
  const db = await getD1Raw();
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO sop_step_confidence (id, execution_id, step_index, score, factors_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(id, params.executionId, params.stepIndex, params.score, JSON.stringify(params.factors), now)
    .run();

  logger.info('[ConfidenceRepo] Confidence logged', { id, executionId: params.executionId, stepIndex: params.stepIndex, score: params.score });
  return id;
}

/** Fetch all confidence scores for an execution. Returns [] on error. */
export async function getConfidenceForExecution(executionId: string): Promise<ConfidenceScore[]> {
  try {
    const db = await getD1Raw();
    const result = await db
      .prepare(
        `SELECT id, execution_id, step_index, score, factors_json, created_at
         FROM sop_step_confidence WHERE execution_id = ?1 ORDER BY step_index ASC`,
      )
      .bind(executionId)
      .all<RawConfidenceRow>();
    return (result.results ?? []).map(mapConfidence);
  } catch (err) {
    logger.error('[ConfidenceRepo] getConfidenceForExecution failed', { executionId, error: getErrorMessage(err) });
    return [];
  }
}

// ── Escalation CRUD ───────────────────────────────────────────────────────────

/** Create a new escalation request. Throws on D1 error. */
export async function createEscalation(params: {
  executionId: string;
  stepIndex: number;
  reason: string;
}): Promise<string> {
  const db = await getD1Raw();
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO escalation_requests (id, execution_id, step_index, reason, status, created_at)
       VALUES (?1, ?2, ?3, ?4, 'pending', ?5)`,
    )
    .bind(id, params.executionId, params.stepIndex, params.reason, now)
    .run();

  logger.info('[ConfidenceRepo] Escalation created', { id, executionId: params.executionId, stepIndex: params.stepIndex });
  return id;
}

/** Update escalation status and resolver. Throws on D1 error. */
export async function resolveEscalation(
  id: string,
  resolvedBy: string,
  status: Extract<EscalationStatus, 'approved' | 'rejected' | 'auto_resolved'>,
): Promise<void> {
  const db = await getD1Raw();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `UPDATE escalation_requests SET status = ?2, resolved_by = ?3, resolved_at = ?4 WHERE id = ?1`,
    )
    .bind(id, status, resolvedBy, now)
    .run();

  logger.info('[ConfidenceRepo] Escalation resolved', { id, status, resolvedBy });
}

/** Fetch pending escalations ordered by created_at DESC. Returns [] on error. */
export async function getPendingEscalations(limit = 50): Promise<EscalationRequest[]> {
  try {
    const db = await getD1Raw();
    const result = await db
      .prepare(
        `SELECT id, execution_id, step_index, reason, status, resolved_by, resolved_at, created_at
         FROM escalation_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT ?1`,
      )
      .bind(limit)
      .all<RawEscalationRow>();
    return (result.results ?? []).map(mapEscalation);
  } catch (err) {
    logger.error('[ConfidenceRepo] getPendingEscalations failed', { error: getErrorMessage(err) });
    return [];
  }
}
