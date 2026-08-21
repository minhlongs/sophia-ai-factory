/**
 * Workflow Checkpoint — save/load intermediate state for workflow steps.
 *
 * Ported from OpenMontage's checkpoint.py pattern, adapted for Sophia's
 * D1-backed workflow stepper. Uses existing `missions.result` column
 * for checkpoint payload (no migration needed).
 *
 * @deprecated 2026-08-16 — duplicate of `@/seed/missions/checkpoint`. The
 * forest copy violates layer rules (a pure utility in the infrastructure
 * layer). The seed copy is layer-compliant and is the live implementation.
 * Removal permitted after 2026-09-16. Tracked in
 * `@/seed/types/deprecation-markers` (DEPRECATION_REGISTRY).
 *
 * When a step mission is interrupted (Worker cold-start, timeout, crash),
 * the stepper can resume from the last checkpoint instead of restarting.
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

export interface CheckpointResult {
  ok: boolean
  checkpoint?: StepCheckpoint
  error?: string
}

export const MAX_CHECKPOINT_BYTES = 48 * 1024 // 48KB — fits in missions.result (TEXT)

/**
 * Serialize checkpoint to JSON string, enforcing size limit.
 */
export function serializeCheckpoint(cp: StepCheckpoint): string {
  const json = JSON.stringify(cp)
  if (json.length > MAX_CHECKPOINT_BYTES) {
    // Trim state field if too large (keep essential fields)
    const trimmed: StepCheckpoint = {
      ...cp,
      state: undefined,
      partialResult: cp.partialResult
        ? Object.fromEntries(
            Object.entries(cp.partialResult).slice(0, 20), // keep first 20 keys
          )
        : undefined,
    }
    const trimmedJson = JSON.stringify(trimmed)
    if (trimmedJson.length > MAX_CHECKPOINT_BYTES) {
      throw new Error(
        `Checkpoint too large: ${trimmedJson.length} bytes (max ${MAX_CHECKPOINT_BYTES})`,
      )
    }
    return trimmedJson
  }
  return json
}

/**
 * Deserialize checkpoint from JSON string.
 */
export function deserializeCheckpoint(
  json: string,
): StepCheckpoint | null {
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
