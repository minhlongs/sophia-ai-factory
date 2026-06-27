/**
 * @module pipeline/checkpoint-service
 *
 * CheckpointService — D1-backed pipeline state persistence for Inngest workflows.
 *
 * Ported from OpenMontage's file-based checkpoint system to Sophia's D1 layer.
 * Key adaptations:
 *   - File paths → D1 rows (pipeline_checkpoints table)
 *   - Decision log JSON file → pipeline_decision_logs append-only table
 *   - JSON Schema → Zod validation (checkpoint-schemas.ts)
 *   - Tenant-scoped: every row keyed by (tenant_id, pipeline_id, stage)
 *
 * Usage:
 *   const svc = new CheckpointService(tenantId);
 *   await svc.writeCheckpoint(pipelineId, 'visual', 'completed', { asset_manifest: {...} });
 *   const latest = await svc.getLatestCheckpoint(pipelineId);
 *   const next = await svc.getNextStage(pipelineId);
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
} from './checkpoint-schemas';

// ── Table name constants ──────────────────────────────────────────────────────

const CHECKPOINTS_TABLE = 'pipeline_checkpoints';
const DECISION_LOGS_TABLE = 'pipeline_decision_logs';

// ── Default pipeline stage order (video_generation pipeline) ─────────────────

const VIDEO_GENERATION_STAGES = [
  'parse_input',
  'generate_tts',
  'generate_video',
  'poll_video_ready',
  'download_video',
  'generate_subtitles',
  'mux_audio_video',
  'update_mission',
  'emit_usage',
] as const;

const REPURPOSE_STAGES = [
  'analyze',
  'clip_generate',
  'transcribe',
  'publish',
] as const;

const CAMPAIGN_STAGES = [
  'scripting',
  'tts',
  'visual',
  'compose',
  'publish',
] as const;

const PIPELINE_STAGE_MAP: Record<string, readonly string[]> = {
  video_generation: VIDEO_GENERATION_STAGES,
  video_repurpose: REPURPOSE_STAGES,
  campaign: CAMPAIGN_STAGES,
};

// ── Service class ─────────────────────────────────────────────────────────────

export class CheckpointService {
  /** Tenant scope — all queries filtered by this ID */
  readonly tenantId: string;

  /**
   * @param tenantId - The tenant/organization ID for row-level scoping.
   *   All checkpoints and decision logs are isolated by this value.
   */
  constructor(tenantId: string) {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error('CheckpointService: tenantId must be a non-empty string');
    }
    this.tenantId = tenantId;
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  /**
   * Write or update a checkpoint for a pipeline stage.
   *
   * Validates the checkpoint shape via Zod, validates stage-specific artifacts,
   * then upserts into D1. If the checkpoint carries decision entries in its
   * artifacts, they are appended to the decision log table.
   *
   * @param pipelineId - Unique pipeline run identifier (e.g. mission ID)
   * @param stage - Pipeline stage name (e.g. "visual", "compose")
   * @param status - Current status: in_progress | completed | failed | skipped
   * @param artifacts - Stage-specific output data (validated per stage)
   * @param options - Optional metadata overrides
   * @returns The checkpoint ID (D1 row UUID)
   */
  async writeCheckpoint(
    pipelineId: string,
    stage: string,
    status: CheckpointStatus,
    artifacts: Record<string, unknown>,
    options?: {
      pipelineType?: PipelineType;
      error?: string;
      metadata?: Record<string, unknown>;
      decisionLog?: Array<{
        decisionId: string;
        decisionType: string;
        stage: string;
        payload: Record<string, unknown>;
      }>;
    },
  ): Promise<string> {
    const pipelineType = options?.pipelineType ?? 'video_generation';
    const validatedPipelineType = PipelineTypeSchema.parse(pipelineType);
    const validatedStatus = CheckpointStatusSchema.parse(status);

    // Validate artifacts for this stage before persisting
    validateArtifactsForStage(stage, artifacts);

    // Build the checkpoint payload
    const checkpointPayload: Checkpoint = {
      version: '1.0',
      tenantId: this.tenantId,
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

    // Validate the full checkpoint shape
    const validated = CheckpointSchema.parse(checkpointPayload);

    const db = createServerClient();

    // Upsert: INSERT OR REPLACE on (tenant_id, pipeline_id, stage) unique key
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
        this.tenantId,
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

    // Append decision log entries (if any) — append-only, dedup by decision_id
    if (validated.decisionLog && validated.decisionLog.length > 0) {
      await this.appendDecisionLog(pipelineId, validated.decisionLog);
    }

    logger.info('[CheckpointService] Checkpoint written', {
      tenantId: this.tenantId,
      pipelineId,
      stage,
      status: validated.status,
      checkpointId: rowId,
    });

    return rowId;
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  /**
   * Read a specific checkpoint by pipeline ID and stage.
   * @returns The validated Checkpoint, or null if not found.
   */
  async readCheckpoint(pipelineId: string, stage: string): Promise<Checkpoint | null> {
    const db = createServerClient();
    const row = await db
      .prepare(
        `SELECT id, pipeline_type, stage, status, artifacts_json,
                error, metadata_json, created_at, updated_at
         FROM ${CHECKPOINTS_TABLE}
         WHERE tenant_id = ? AND pipeline_id = ? AND stage = ?`,
      )
      .bind(this.tenantId, pipelineId, stage)
      .first<{
        id: string;
        pipeline_type: string;
        stage: string;
        status: string;
        artifacts_json: string;
        error: string | null;
        metadata_json: string;
        created_at: string;
        updated_at: string;
      }>();

    if (!row) return null;

    return this.rowToCheckpoint(pipelineId, row);
  }

  /**
   * Get the most recently updated checkpoint for a pipeline.
   * @returns The latest Checkpoint, or null if none exist.
   */
  async getLatestCheckpoint(pipelineId: string): Promise<Checkpoint | null> {
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
      .bind(this.tenantId, pipelineId)
      .first<{
        id: string;
        pipeline_type: string;
        stage: string;
        status: string;
        artifacts_json: string;
        error: string | null;
        metadata_json: string;
        created_at: string;
        updated_at: string;
      }>();

    if (!row) return null;
    return this.rowToCheckpoint(pipelineId, row);
  }

  // ── Stage navigation ───────────────────────────────────────────────────────

  /**
   * Get all completed stage names for a pipeline.
   * Only returns stages with status === 'completed'.
   * @returns Array of stage names in pipeline order.
   */
  async getCompletedStages(pipelineId: string): Promise<string[]> {
    const db = createServerClient();
    const rows = await db
      .prepare(
        `SELECT stage, pipeline_type
         FROM ${CHECKPOINTS_TABLE}
         WHERE tenant_id = ? AND pipeline_id = ? AND status = 'completed'
         ORDER BY updated_at ASC`,
      )
      .bind(this.tenantId, pipelineId)
      .all<{ stage: string; pipeline_type: string }>();

  if (rows.results.length === 0) return [];

  // Return in canonical pipeline order (not DB insertion order)
  const pipelineType = rows.results[rows.results.length - 1]!.pipeline_type;
  const canonicalStages = PIPELINE_STAGE_MAP[pipelineType] ?? [];
  const completedSet = new Set(rows.results.map((r) => r.stage));
  return canonicalStages.filter((s) => completedSet.has(s));
}

  /**
   * Determine the next stage to execute based on completed checkpoints.
   *
   * Uses the pipeline_type's canonical stage order. Returns null if all
   * stages are completed or the pipeline type is unknown.
   */
  async getNextStage(pipelineId: string): Promise<string | null> {
    const latest = await this.getLatestCheckpoint(pipelineId);
    if (!latest) {
      // No checkpoint yet — return the first stage of the default pipeline
      return this.getFirstStage('video_generation');
    }

    const stages = PIPELINE_STAGE_MAP[latest.pipelineType];
    if (!stages) return null;

    const completed = await this.getCompletedStages(pipelineId);
    const completedSet = new Set(completed);

    for (const stage of stages) {
      if (!completedSet.has(stage)) {
        return stage;
      }
    }

    // All stages completed
    return null;
  }

  // ── Decision log ───────────────────────────────────────────────────────────

  /**
   * Append decision entries to the append-only decision log.
   * Deduplicates by decision_id — existing entries are not duplicated.
   *
   * @param pipelineId - Pipeline run identifier
   * @param decisions - Array of decision entries to append
   */
  async appendDecisionLog(
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

    // Batch insert with ON CONFLICT DO NOTHING for idempotency
    const stmt = db.prepare(
      `INSERT INTO ${DECISION_LOGS_TABLE}
        (id, tenant_id, pipeline_id, decision_id, decision_type, stage, payload_json, created_at)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, pipeline_id, decision_id) DO NOTHING`,
    );

    const bound = decisions.map((d) =>
      stmt.bind(this.tenantId, pipelineId, d.decisionId, d.decisionType, d.stage, JSON.stringify(d.payload), now),
    );

    await db.unwrap().batch(bound);

    logger.debug('[CheckpointService] Decision log appended', {
      tenantId: this.tenantId,
      pipelineId,
      count: decisions.length,
    });
  }

  /**
   * Read the full decision log for a pipeline.
   * @returns Array of decision entries ordered by creation time.
   */
  async getDecisionLog(pipelineId: string): Promise<
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
      .bind(this.tenantId, pipelineId)
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

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Convert a D1 row to a validated Checkpoint object.
   */
  private rowToCheckpoint(pipelineId: string, row: {
    id: string;
    pipeline_type: string;
    stage: string;
    status: string;
    artifacts_json: string;
    error: string | null;
    metadata_json: string;
    created_at: string;
    updated_at: string;
  }): Checkpoint {
    const artifacts = JSON.parse(row.artifacts_json) as Record<string, unknown>;
    const metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;

    // Reconstruct ISO timestamp from D1 datetime string
    const timestamp = new Date(row.updated_at).toISOString();

    const raw: Checkpoint = {
      version: '1.0',
      tenantId: this.tenantId,
      pipelineId,
      pipelineType: row.pipeline_type as PipelineType,
      stage: row.stage,
      status: row.status as CheckpointStatus,
      artifacts,
  metadata,
      timestamp,
    };

    // Validate through Zod — this ensures data integrity even if
    // rows were written outside this service
    const validated = CheckpointSchema.parse(raw);

    if (row.error) {
      validated.error = row.error;
    }
    validated.metadata = metadata;

    return validated;
  }

  /**
   * Get the first stage for a given pipeline type.
   */
  private getFirstStage(pipelineType: string): string | null {
    const stages = PIPELINE_STAGE_MAP[pipelineType];
    return stages?.[0] ?? null;
  }
}
