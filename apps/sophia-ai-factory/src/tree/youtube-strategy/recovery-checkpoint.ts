/**
 * Per-stage checkpoint management for YouTube content generation.
 * Exponential backoff retry, artifact validation, resume from last checkpoint.
 * Ported from Lumen's generation-recovery-service.
 */

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

const GENERATION_STAGES: readonly GenerationStage[] = [
  'strategy',
  'script',
  'thumbnail',
  'seo',
  'production',
  'quality_review',
];

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
      if (
        (err as { code?: string }).code === 'JOB_CANCELLED' ||
        attempt >= maxAttempts ||
        !isRetryable(err)
      ) {
        throw lastError;
      }
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }
  throw lastError ?? new Error(`Stage ${stage} failed after ${maxAttempts} attempts`);
}

function validateArtifact(stage: GenerationStage, artifact: unknown): boolean {
  if (!artifact || typeof artifact !== 'object') return false;
  const a = artifact as Record<string, unknown>;
  switch (stage) {
    case 'strategy':
      return Boolean(a.topic);
    case 'script':
      return Boolean(a.title && (a.fullScript || a.mainContent));
    case 'thumbnail':
      return Boolean(a.path);
    case 'seo':
      return Boolean(a.title && a.description && Array.isArray(a.tags));
    case 'production': {
      const finalVideo = (a.assets as Record<string, unknown> | undefined)?.finalVideo;
      return Boolean(a.id && (finalVideo as Record<string, unknown> | undefined)?.path);
    }
    case 'quality_review':
      return Boolean(a.contentId && a.reviewStatus);
    default:
      return false;
  }
}

function isRetryable(error: unknown): boolean {
  const err = error as { status?: number; code?: string; response?: { status?: number } };
  const status = Number(err.status ?? err.response?.status ?? 0);
  if ([408, 425, 429].includes(status) || status >= 500) return true;
  const code = String(err.code ?? '').toUpperCase();
  return [
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ETIMEDOUT',
    'ENETUNREACH',
    'EAI_AGAIN',
  ].includes(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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