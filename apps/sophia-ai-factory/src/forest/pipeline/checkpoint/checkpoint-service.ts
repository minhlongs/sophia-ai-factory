/**
 * CheckpointService — D1-backed pipeline state persistence for Inngest workflows
 *
 * @module forest/pipeline/checkpoint/checkpoint-service
 */

import {
  type Checkpoint,
  type CheckpointStatus,
  type PipelineType,
} from '../checkpoint-schemas';
import {
  writeCheckpointRecord,
  appendDecisionLogRecords,
  WriteCheckpointOptions,
} from './checkpoint-writer';
import {
  readCheckpointRecord,
  getLatestCheckpointRecord,
  getCompletedStagesRecord,
  getNextStageRecord,
  getDecisionLogRecords,
} from './checkpoint-reader';

/**
 * Service class for tenant-scoped pipeline checkpoints and decision logs
 */
export class CheckpointService {
  /** Tenant scope — all queries filtered by this ID */
  readonly tenantId: string;

  /**
   * @param tenantId - The tenant/organization ID for row-level scoping.
   */
  constructor(tenantId: string) {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error('CheckpointService: tenantId must be a non-empty string');
    }
    this.tenantId = tenantId;
  }

  /**
   * Write or update a checkpoint for a pipeline stage.
   */
  async writeCheckpoint(
    pipelineId: string,
    stage: string,
    status: CheckpointStatus,
    artifacts: Record<string, unknown>,
    options?: WriteCheckpointOptions,
  ): Promise<string> {
    return writeCheckpointRecord(this.tenantId, pipelineId, stage, status, artifacts, options);
  }

  /**
   * Read a specific checkpoint by pipeline ID and stage.
   */
  async readCheckpoint(pipelineId: string, stage: string): Promise<Checkpoint | null> {
    return readCheckpointRecord(this.tenantId, pipelineId, stage);
  }

  /**
   * Get the most recently updated checkpoint for a pipeline.
   */
  async getLatestCheckpoint(pipelineId: string): Promise<Checkpoint | null> {
    return getLatestCheckpointRecord(this.tenantId, pipelineId);
  }

  /**
   * Get all completed stage names for a pipeline.
   */
  async getCompletedStages(pipelineId: string): Promise<string[]> {
    return getCompletedStagesRecord(this.tenantId, pipelineId);
  }

  /**
   * Determine the next stage to execute based on completed checkpoints.
   */
  async getNextStage(pipelineId: string): Promise<string | null> {
    return getNextStageRecord(this.tenantId, pipelineId);
  }

  /**
   * Append decision entries to the append-only decision log.
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
    return appendDecisionLogRecords(this.tenantId, pipelineId, decisions);
  }

  /**
   * Read the full decision log for a pipeline.
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
    return getDecisionLogRecords(this.tenantId, pipelineId);
  }
}
