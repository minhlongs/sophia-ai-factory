/**
 * Per-stage checkpoint management for YouTube content generation.
 * Exponential backoff retry, artifact validation, resume from last checkpoint.
 * Ported from Lumen's generation-recovery-service.
 */

import {
  GENERATION_STAGES,
  validateArtifact,
  isRetryable,
  sleep,
} from './recovery-checkpoint-helpers';
import {
  type GenerationStage,
  type Checkpoint,
  type CheckpointStore,
  type RecoveryServiceOptions,
  resumePoint,
  resetFrom,
} from './recovery-checkpoint-types';

export type {
  GenerationStage,
  Checkpoint,
  CheckpointStore,
  RecoveryServiceOptions,
};
export { resumePoint, resetFrom };

const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_BASE_DELAY_MS = 1000;

/**
 * Run a generation stage with checkpointing and retry.
 */
export async function runStage<T>(
  store: CheckpointStore,
  jobId: string,
  stage: GenerationStage,
  producer: () => Promise<T>,
  options: RecoveryServiceOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);

  const checkpoint = await store.getGenerationCheckpoint(jobId, stage);
  if (checkpoint?.status === 'completed') {
    if (validateArtifact(stage, checkpoint.artifact)) {
      return checkpoint.artifact as T;
    }
    const stageIndex = GENERATION_STAGES.indexOf(stage);
    await store.deleteGenerationCheckpoints(jobId, GENERATION_STAGES.slice(stageIndex + 1));
    await store.saveGenerationCheckpoint(jobId, stage, {
      status: 'invalid',
      error: 'The saved artifact is missing or no longer valid',
      completedAt: null,
    });
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await store.saveGenerationCheckpoint(jobId, stage, {
      status: 'running',
      error: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
      attempt,
    });
    try {
      const artifact = await producer();
      if (!validateArtifact(stage, artifact)) {
        throw new Error(`${stage} produced an incomplete or missing artifact`);
      }
      await store.saveGenerationCheckpoint(jobId, stage, {
        status: 'completed',
        artifact: artifact as Record<string, unknown>,
        error: null,
        completedAt: new Date().toISOString(),
      });
      return artifact;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      await store.saveGenerationCheckpoint(jobId, stage, {
        status: (err as { code?: string }).code === 'JOB_CANCELLED' ? 'cancelled' : 'failed',
        error: lastError.message,
        completedAt: new Date().toISOString(),
      });
      if ((err as { code?: string }).code === 'JOB_CANCELLED' || attempt >= maxAttempts || !isRetryable(err)) {
        throw lastError;
      }
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      if (delayMs > 0) await sleep(delayMs);
    }
  }
  throw lastError ?? new Error(`Stage ${stage} failed after ${maxAttempts} attempts`);
}
