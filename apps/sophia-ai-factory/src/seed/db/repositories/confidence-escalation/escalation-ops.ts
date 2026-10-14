import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { EscalationRequest, EscalationStatus } from '@/seed/types/confidence';
import type { RawEscalationRow } from './types';
import { mapEscalation } from './types';

/** Create a new escalation request. Throws on D1 error. */
export async function createEscalation(params: {
  executionId: string;
  stepIndex: number;
  reason: string;
}): Promise<string> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO escalation_requests (id, execution_id, step_index, reason, status, created_at)
       VALUES (?1, ?2, ?3, ?4, 'pending', ?5)`,
    )
    .bind(id, params.executionId, params.stepIndex, params.reason, now)
    .run();

  logger.info('[ConfidenceRepo] Escalation created', {
    id,
    executionId: params.executionId,
    stepIndex: params.stepIndex,
  });
  return id;
}

/** Update escalation status and resolver. Throws on D1 error. */
export async function resolveEscalation(
  id: string,
  resolvedBy: string,
  status: Extract<EscalationStatus, 'approved' | 'rejected' | 'auto_resolved'>,
): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `UPDATE escalation_requests SET status = ?2, resolved_by = ?3, resolved_at = ?4 WHERE id = ?1`,
    )
    .bind(id, status, resolvedBy, now)
    .run();

  logger.info('[ConfidenceRepo] Escalation resolved', { id, status, resolvedBy });
}

/** Fetch recent escalations across all executions. Returns [] on error. */
export async function getRecentEscalations(limit = 50): Promise<EscalationRequest[]> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const result = await db
      .prepare(
        `SELECT id, execution_id, step_index, reason, status, resolved_by, resolved_at, created_at
         FROM escalation_requests ORDER BY created_at DESC LIMIT ?1`,
      )
      .bind(limit)
      .all<RawEscalationRow>();
    return (result.results ?? []).map(mapEscalation);
  } catch (err) {
    logger.error('[ConfidenceRepo] getRecentEscalations failed', {
      error: getErrorMessage(err),
    });
    return [];
  }
}

/** Fetch pending escalations ordered by created_at DESC. Returns [] on error. */
export async function getPendingEscalations(limit = 50): Promise<EscalationRequest[]> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const result = await db
      .prepare(
        `SELECT id, execution_id, step_index, reason, status, resolved_by, resolved_at, created_at
         FROM escalation_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT ?1`,
      )
      .bind(limit)
      .all<RawEscalationRow>();
    return (result.results ?? []).map(mapEscalation);
  } catch (err) {
    logger.error('[ConfidenceRepo] getPendingEscalations failed', {
      error: getErrorMessage(err),
    });
    return [];
  }
}
