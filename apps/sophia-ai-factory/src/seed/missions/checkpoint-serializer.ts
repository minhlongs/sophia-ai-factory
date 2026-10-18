/**
 * Checkpoint serialization, size limits, and pure state helpers.
 * @module seed/missions/checkpoint-serializer
 */

export interface StepCheckpoint {
  /** Mission ID this checkpoint belongs to */
  missionId: string
  /** Workflow ID */
  workflowId: string
  /** Step order (1-indexed) */
  stepOrder: number
  /** Step type */
  stepType: string
  /** Timestamp when checkpoint was saved */
  savedAt: string
  /** Partial result from the step (if any) */
  partialResult?: Record<string, unknown>
  /** Tokens consumed so far */
  tokensUsed?: number
  /** Provider used for this step */
  provider?: string
  /** Model used for this step */
  model?: string
  /** Retry count for this step */
  retryCount: number
  /** Arbitrary state the step can resume from */
  state?: Record<string, unknown>
}

/** Alias for backward compatibility */
export type CheckpointData = StepCheckpoint

export interface CheckpointResult {
  ok: boolean
  checkpoint?: StepCheckpoint
  error?: string
}

export const MAX_CHECKPOINT_BYTES = 48 * 1024 // 48KB

/**
 * Serialize checkpoint to JSON string, enforcing size limit.
 */
export function serializeCheckpoint(cp: StepCheckpoint): string {
  const json = JSON.stringify(cp)
  if (json.length > MAX_CHECKPOINT_BYTES) {
    const trimmed: StepCheckpoint = {
      ...cp,
      state: undefined,
      partialResult: cp.partialResult
        ? Object.fromEntries(Object.entries(cp.partialResult).slice(0, 20))
        : undefined,
    }
    const trimmedJson = JSON.stringify(trimmed)
    if (trimmedJson.length > MAX_CHECKPOINT_BYTES) {
      throw new Error(`Checkpoint too large: ${trimmedJson.length} bytes (max ${MAX_CHECKPOINT_BYTES})`)
    }
    return trimmedJson
  }
  return json
}

/**
 * Deserialize checkpoint from JSON string.
 */
export function deserializeCheckpoint(json: string): StepCheckpoint | null {
  try {
    return JSON.parse(json) as StepCheckpoint
  } catch {
    return null
  }
}

/**
 * Create a new checkpoint for a step mission.
 */
export function createCheckpoint(
  missionId: string,
  workflowId: string,
  stepOrder: number,
  stepType: string,
  opts: Partial<Omit<StepCheckpoint, 'missionId' | 'workflowId' | 'stepOrder' | 'stepType' | 'savedAt' | 'retryCount'>> = {},
): StepCheckpoint {
  return {
    missionId,
    workflowId,
    stepOrder,
    stepType,
    savedAt: new Date().toISOString(),
    retryCount: 0,
    ...opts,
  }
}

/**
 * Increment retry count on an existing checkpoint.
 */
export function incrementRetry(cp: StepCheckpoint): StepCheckpoint {
  return { ...cp, retryCount: cp.retryCount + 1, savedAt: new Date().toISOString() }
}
