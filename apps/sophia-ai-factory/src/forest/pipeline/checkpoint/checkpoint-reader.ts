/**
 * Pipeline checkpoint read, stage traversal, and decision log retrieval
 *
 * @module forest/pipeline/checkpoint/checkpoint-reader
 */

import { createServerClient } from '@/seed/db/client';
import {
  CheckpointSchema,
  type Checkpoint,
  type CheckpointStatus,
  type PipelineType,
} from '../checkpoint-schemas';
import { CHECKPOINTS_TABLE } from './constants';
export {
  getCompletedStagesRecord,
  getNextStageRecord,
  getDecisionLogRecords,
} from './checkpoint-stage-queries';

export interface CheckpointDbRow {
  id: string;
  pipeline_type: string;
  stage: string;
  status: string;
  artifacts_json: string;
  error: string | null;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

/** Convert a D1 row to a validated Checkpoint object. */
export function rowToCheckpoint(
  tenantId: string,
  pipelineId: string,
  row: CheckpointDbRow,
): Checkpoint {
  const artifacts = JSON.parse(row.artifacts_json) as Record<string, unknown>;
  const metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
  const timestamp = new Date(row.updated_at).toISOString();

  const raw: Checkpoint = {
    version: '1.0',
    tenantId,
    pipelineId,
    pipelineType: row.pipeline_type as PipelineType,
    stage: row.stage,
    status: row.status as CheckpointStatus,
    artifacts,
    metadata,
    timestamp,
  };

  const validated = CheckpointSchema.parse(raw);
  if (row.error) validated.error = row.error;
  validated.metadata = metadata;
  return validated;
}

/** Read a specific checkpoint by pipeline ID and stage. */
export async function readCheckpointRecord(
  tenantId: string,
  pipelineId: string,
  stage: string,
): Promise<Checkpoint | null> {
  const db = createServerClient();
  const row = await db
    .prepare(
      `SELECT id, pipeline_type, stage, status, artifacts_json,
              error, metadata_json, created_at, updated_at
       FROM ${CHECKPOINTS_TABLE}
       WHERE tenant_id = ? AND pipeline_id = ? AND stage = ?`,
    )
    .bind(tenantId, pipelineId, stage)
    .first<CheckpointDbRow>();

  return row ? rowToCheckpoint(tenantId, pipelineId, row) : null;
}

/** Get the most recently updated checkpoint for a pipeline. */
export async function getLatestCheckpointRecord(
  tenantId: string,
  pipelineId: string,
): Promise<Checkpoint | null> {
  const db = createServerClient();
  const row = await db
    .prepare(
      `SELECT id, pipeline_type, stage, status, artifacts_json,
              error, metadata_json, created_at, updated_at
       FROM ${CHECKPOINTS_TABLE}
       WHERE tenant_id = ? AND pipeline_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .bind(tenantId, pipelineId)
    .first<CheckpointDbRow>();

  return row ? rowToCheckpoint(tenantId, pipelineId, row) : null;
}
