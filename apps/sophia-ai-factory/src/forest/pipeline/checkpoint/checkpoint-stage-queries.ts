/**
 * Pipeline stage progression and decision log queries
 *
 * @module forest/pipeline/checkpoint/checkpoint-stage-queries
 */

import { createServerClient } from '@/seed/db/client';
import { CHECKPOINTS_TABLE, DECISION_LOGS_TABLE, PIPELINE_STAGE_MAP } from './constants';
import { getLatestCheckpointRecord } from './checkpoint-reader';

/** Get all completed stage names for a pipeline. */
export async function getCompletedStagesRecord(
  tenantId: string,
  pipelineId: string,
): Promise<string[]> {
  const db = createServerClient();
  const rows = await db
    .prepare(
      `SELECT stage, pipeline_type
       FROM ${CHECKPOINTS_TABLE}
       WHERE tenant_id = ? AND pipeline_id = ? AND status = 'completed'
       ORDER BY updated_at ASC`,
    )
    .bind(tenantId, pipelineId)
    .all<{ stage: string; pipeline_type: string }>();

  if (rows.results.length === 0) return [];
  const pipelineType = rows.results[rows.results.length - 1]!.pipeline_type;
  const canonicalStages = PIPELINE_STAGE_MAP[pipelineType] ?? [];
  const completedSet = new Set(rows.results.map((r) => r.stage));
  return canonicalStages.filter((s) => completedSet.has(s));
}

/** Determine the next stage to execute based on completed checkpoints. */
export async function getNextStageRecord(
  tenantId: string,
  pipelineId: string,
): Promise<string | null> {
  const latest = await getLatestCheckpointRecord(tenantId, pipelineId);
  if (!latest) {
    return PIPELINE_STAGE_MAP.video_generation?.[0] ?? null;
  }
  const stages = PIPELINE_STAGE_MAP[latest.pipelineType];
  if (!stages) return null;

  const completed = await getCompletedStagesRecord(tenantId, pipelineId);
  const completedSet = new Set(completed);
  for (const stage of stages) {
    if (!completedSet.has(stage)) return stage;
  }
  return null;
}

/** Read the full decision log for a pipeline. */
export async function getDecisionLogRecords(
  tenantId: string,
  pipelineId: string,
): Promise<
  Array<{
    decisionId: string;
    decisionType: string;
    stage: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>
> {
  const db = createServerClient();
  const rows = await db
    .prepare(
      `SELECT decision_id, decision_type, stage, payload_json, created_at
       FROM ${DECISION_LOGS_TABLE}
       WHERE tenant_id = ? AND pipeline_id = ?
       ORDER BY created_at ASC`,
    )
    .bind(tenantId, pipelineId)
    .all<{
      decision_id: string;
      decision_type: string;
      stage: string;
      payload_json: string;
      created_at: string;
    }>();

  return rows.results.map((r) => ({
    decisionId: r.decision_id,
    decisionType: r.decision_type,
    stage: r.stage,
    payload: JSON.parse(r.payload_json) as Record<string, unknown>,
    createdAt: r.created_at,
  }));
}
