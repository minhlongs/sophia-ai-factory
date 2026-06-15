/**
 * Checkpoint persistence for agent task assignments.
 * Allows failed multi-step pipelines to resume from the last successful step.
 *
 * Layer: tree (imports seed only)
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'

/** Maximum checkpoint size in bytes (64KB) — D1 TEXT is unbounded but we cap for sanity */
const MAX_CHECKPOINT_BYTES = 65536

/**
 * Persist a checkpoint for an in-progress task.
 * Only updates tasks in 'pending' or 'running' status to prevent
 * overwriting a settled task's null checkpoint.
 *
 * @throws Error if checkpoint exceeds 64KB
 */
export async function saveCheckpoint(
  taskId: string,
  checkpoint: Record<string, unknown>,
): Promise<void> {
  const serialized = JSON.stringify(checkpoint)
  if (serialized.length > MAX_CHECKPOINT_BYTES) {
    throw new Error(
      `Checkpoint too large: ${serialized.length} bytes (max ${MAX_CHECKPOINT_BYTES}). Task: ${taskId}`,
    )
  }

  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  try {
    await db
      .prepare(
        `UPDATE agent_task_assignments
         SET checkpoint_json = ?
         WHERE id = ? AND status IN ('pending', 'running')`,
      )
      .bind(serialized, taskId)
      .run()

    logger.info('multi-agent: checkpoint saved', { taskId })
  } catch (err) {
    logger.error('multi-agent: saveCheckpoint failed', { taskId, error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Load the checkpoint for a task.
 * Returns null if the task has no checkpoint or does not exist.
 * JSON parse errors are caught and logged (not re-thrown) — returns null on parse failure.
 */
export async function loadCheckpoint(
  taskId: string,
): Promise<Record<string, unknown> | null> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  try {
    const row = await db
      .prepare(`SELECT checkpoint_json FROM agent_task_assignments WHERE id = ?`)
      .bind(taskId)
      .first<{ checkpoint_json: string | null }>()

    if (!row?.checkpoint_json) return null

    try {
      return JSON.parse(row.checkpoint_json) as Record<string, unknown>
    } catch (parseErr) {
      logger.error('multi-agent: checkpoint parse error', {
        taskId,
        error: getErrorMessage(parseErr),
      })
      return null
    }
  } catch (err) {
    logger.error('multi-agent: loadCheckpoint failed', { taskId, error: getErrorMessage(err) })
    throw err
  }
}
