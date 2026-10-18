/**
 * Types and Resume/Reset Operations for YouTube Content Generation Checkpoints
 *
 * Layer: tree/youtube-strategy
 *
 * @module tree/youtube-strategy/recovery-checkpoint-types
 */

import { GENERATION_STAGES } from './recovery-checkpoint-helpers';

export type GenerationStage =
  | 'strategy'
  | 'script'
  | 'thumbnail'
  | 'seo'
  | 'production'
  | 'quality_review';

export interface Checkpoint {
  readonly stage: GenerationStage;
  readonly status: 'running' | 'completed' | 'failed' | 'cancelled' | 'invalid';
  readonly artifact?: Record<string, unknown>;
  readonly error?: string | null;
  readonly startedAt?: string | null;
  readonly completedAt?: string | null;
  readonly attempt?: number;
}

export interface CheckpointStore {
  getGenerationCheckpoint(jobId: string, stage: GenerationStage): Promise<Checkpoint | null>;
  saveGenerationCheckpoint(
    jobId: string,
    stage: GenerationStage,
    data: Partial<Checkpoint>,
  ): Promise<void>;
  deleteGenerationCheckpoints(jobId: string, stages: GenerationStage[]): Promise<void>;
  getGenerationJob(jobId: string): Promise<Record<string, unknown> | null>;
}

export interface RecoveryServiceOptions {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
}

/**
 * Determine the next stage to resume from, given a list of checkpoints.
 */
export function resumePoint(checkpoints: readonly Checkpoint[]): GenerationStage {
  const byStage = new Map(checkpoints.map((c) => [c.stage, c] as const));
  return (
    (GENERATION_STAGES.find((s) => byStage.get(s)?.status !== 'completed') as GenerationStage) ??
    'quality_review'
  );
}

/**
 * Delete checkpoints from a given stage onward.
 */
export async function resetFrom(
  store: CheckpointStore,
  jobId: string,
  requestedStage: GenerationStage,
): Promise<void> {
  if (!GENERATION_STAGES.includes(requestedStage)) {
    throw new Error(`Resume stage is not supported: ${requestedStage}`);
  }
  const index = GENERATION_STAGES.indexOf(requestedStage);
  await store.deleteGenerationCheckpoints(jobId, GENERATION_STAGES.slice(index));
}
