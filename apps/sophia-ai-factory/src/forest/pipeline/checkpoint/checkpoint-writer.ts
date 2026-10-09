/**
 * Pipeline checkpoint write and decision log append operations
 *
 * @module forest/pipeline/checkpoint/checkpoint-writer
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  CheckpointSchema,
  CheckpointStatusSchema,
  PipelineTypeSchema,
  type Checkpoint,
  type CheckpointStatus,
  type PipelineType,
  validateArtifactsForStage,
  DecisionEntrySchema,
} from '../checkpoint-schemas';
import { CHECKPOINTS_TABLE, DECISION_LOGS_TABLE } from './constants';

export interface WriteCheckpointOptions {
  pipelineType?: PipelineType;
  error?: string;
  metadata?: Record<string, unknown>;
  decisionLog?: Array<{
    decisionId: string;
    decisionType: string;
    stage: string;
    payload: Record<string, unknown>;
  }>;
}

/**
 * Append decision entries to the append-only decision log.
 */
export async function appendDecisionLogRecords(
  tenantId: string,
  pipelineId: string,
  decisions: Array<{
    decisionId: string;
    decisionType: string;
    stage: string;
    payload: Record<string, unknown>;
  }>,
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
    stmt.bind(tenantId, pipelineId, d.decisionId, d.decisionType, d.stage, JSON.stringify(d.payload), now),
  );

  await db.unwrap().batch(bound);

  logger.debug('[CheckpointService] Decision log appended', {
    tenantId,
    pipelineId,
    count: decisions.length,
  });
}

/**
 * Write or update a checkpoint for a pipeline stage.
 */
export async function writeCheckpointRecord(
  tenantId: string,
  pipelineId: string,
  stage: string,
  status: CheckpointStatus,
  artifacts: Record<string, unknown>,
  options?: WriteCheckpointOptions,
): Promise<string> {
  const pipelineType = options?.pipelineType ?? 'video_generation';
  const validatedPipelineType = PipelineTypeSchema.parse(pipelineType);
  const validatedStatus = CheckpointStatusSchema.parse(status);

  validateArtifactsForStage(stage, artifacts);

  const checkpointPayload: Checkpoint = {
    version: '1.0',
    tenantId,
    pipelineId,
    pipelineType: validatedPipelineType,
    stage,
    status: validatedStatus,
    artifacts,
    metadata: {},
    timestamp: new Date().toISOString(),
  };

  if (options?.error) {
    checkpointPayload.error = options.error;
  }
  if (options?.metadata) {
    checkpointPayload.metadata = options.metadata;
  }
  if (options?.decisionLog && options.decisionLog.length > 0) {
    checkpointPayload.decisionLog = options.decisionLog.map((d) =>
      DecisionEntrySchema.parse({
        ...d,
        createdAt: new Date().toISOString(),
      }),
    );
  }

  const validated = CheckpointSchema.parse(checkpointPayload);
  const db = createServerClient();

  const checkpointId = await db
    .prepare(
      `INSERT INTO ${CHECKPOINTS_TABLE}
        (id, tenant_id, pipeline_id, pipeline_type, stage, status,
         artifacts_json, error, metadata_json, updated_at)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(tenant_id, pipeline_id, stage) DO UPDATE SET
         status = excluded.status,
         artifacts_json = excluded.artifacts_json,
         error = excluded.error,
         metadata_json = excluded.metadata_json,
         updated_at = datetime('now')`,
    )
    .bind(
      tenantId,
      pipelineId,
      validated.pipelineType,
      stage,
      validated.status,
      JSON.stringify(validated.artifacts),
      validated.error ?? null,
      JSON.stringify(validated.metadata),
    )
    .first<{ id: string }>();

  const rowId = checkpointId?.id ?? '';

  if (validated.decisionLog && validated.decisionLog.length > 0) {
    await appendDecisionLogRecords(tenantId, pipelineId, validated.decisionLog);
  }

  logger.info('[CheckpointService] Checkpoint written', {
    tenantId,
    pipelineId,
    stage,
    status: validated.status,
    checkpointId: rowId,
  });

  return rowId;
}
