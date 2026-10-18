/**
 * Pipeline decision log append operations
 *
 * @module forest/pipeline/checkpoint/decision-log-writer
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { DECISION_LOGS_TABLE } from './constants';

export interface DecisionLogRecordInput {
  decisionId: string;
  decisionType: string;
  stage: string;
  payload: Record<string, unknown>;
}

/**
 * Append decision entries to the append-only decision log.
 */
export async function appendDecisionLogRecords(
  tenantId: string,
  pipelineId: string,
  decisions: DecisionLogRecordInput[],
): Promise<void> {
  if (decisions.length === 0) return;

  const db = createServerClient();
  const now = new Date().toISOString();

  const stmt = db.prepare(
    `INSERT INTO ${DECISION_LOGS_TABLE}
      (id, tenant_id, pipeline_id, decision_id, decision_type, stage, payload_json, created_at)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, pipeline_id, decision_id) DO NOTHING`,
  );

  const bound = decisions.map((d) =>
    stmt.bind(
      tenantId,
      pipelineId,
      d.decisionId,
      d.decisionType,
      d.stage,
      JSON.stringify(d.payload),
      now,
    ),
  );

  await db.unwrap().batch(bound);

  logger.debug('[CheckpointService] Decision log appended', {
    tenantId,
    pipelineId,
    count: decisions.length,
  });
}
