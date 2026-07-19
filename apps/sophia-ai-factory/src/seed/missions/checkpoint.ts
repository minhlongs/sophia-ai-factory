/**
 * Workflow Checkpoint — pure utility (moved from forest/workflows/checkpoint.ts)
 *
 * Portable checkpoint serialization for mission/step state persistence.
 * No layer-specific imports — safe for seed/.
 */

import { createServerClient } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'

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

/**
 * Save checkpoint to engine_missions.checkpoint_json
 */
export async function saveMissionCheckpoint(
  missionId: string,
  data: CheckpointData,
): Promise<boolean> {
  try {
    const db = createServerClient()
    const cp = createCheckpoint(missionId, '', data.stepOrder, data.stepType, {
      partialResult: data.partialResult,
      tokensUsed: data.tokensUsed,
      provider: data.provider,
      model: data.model,
      state: data.state,
    })
    const json = serializeCheckpoint(cp)

    await db
      .from('engine_missions')
      .update({ checkpoint_json: json, updated_at: Math.floor(Date.now() / 1000) })
      .eq('id', missionId)

    return true
  } catch (err) {
    logger.error('[Checkpoint] Failed to save', { missionId, err })
    return false
  }
}

/**
 * Load checkpoint from engine_missions.checkpoint_json
 * Returns null if no checkpoint exists or deserialization fails.
 */
export async function loadMissionCheckpoint(missionId: string): Promise<StepCheckpoint | null> {
  try {
    const db = createServerClient()
    const { data } = await db
      .from('engine_missions')
      .select('checkpoint_json')
      .eq('id', missionId)
      .single()

    const json = (data as { checkpoint_json: string | null } | null)?.checkpoint_json
    if (!json) return null

    return deserializeCheckpoint(json)
  } catch {
    return null
  }
}

/**
 * Clear checkpoint after successful completion (cleanup).
 */
export async function clearMissionCheckpoint(missionId: string): Promise<void> {
  try {
    const db = createServerClient()
    await db
      .from('engine_missions')
      .update({ checkpoint_json: null, updated_at: Math.floor(Date.now() / 1000) })
      .eq('id', missionId)
  } catch (err) {
    logger.warn('[Checkpoint] Failed to clear', { missionId, err })
  }
}
