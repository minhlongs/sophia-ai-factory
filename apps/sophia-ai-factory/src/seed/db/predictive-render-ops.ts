/**
 * Seed Layer: Growth Triad v14 Predictive Render Database Operations
 * D1 SQLite operations for predictive render jobs and lifecycle state.
 * Layer: seed/db | Max LOC: < 200 | Zero :any
 * @module seed/db/predictive-render-ops
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  PredictiveRenderJob,
  RenderJobStatus,
} from '@/seed/types/growth-triad-v14';
import { getJobsForUser } from './predictive-render-queries';

export { getJobsForUser };

export interface CreateJobInput {
  id: string;
  userId: string;
  scriptId: string;
  mabArmId?: string;
  deliberationScore: number;
  kellyAllocationFraction: number;
  allocatedMcu: number;
}

/**
 * Creates a new predictive render job in D1.
 */
export async function createPredictiveRenderJob(
  input: CreateJobInput
): Promise<PredictiveRenderJob | null> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for createPredictiveRenderJob');
    return null;
  }

  const now = Date.now();
  try {
    const stmt = db.prepare(
      `INSERT INTO growth_predictive_render_jobs (
        id, user_id, script_id, mab_arm_id, deliberation_score,
        kelly_allocation_fraction, allocated_mcu, actual_mcu_consumed,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'QUEUED', ?, ?)`
    );

    await stmt
      .bind(
        input.id,
        input.userId,
        input.scriptId,
        input.mabArmId ?? null,
        input.deliberationScore,
        input.kellyAllocationFraction,
        input.allocatedMcu,
        now,
        now
      )
      .run();

    return {
      id: input.id,
      userId: input.userId,
      scriptId: input.scriptId,
      mabArmId: input.mabArmId,
      deliberationScore: input.deliberationScore,
      kellyAllocationFraction: input.kellyAllocationFraction,
      allocatedMcu: input.allocatedMcu,
      actualMcuConsumed: 0,
      status: 'QUEUED',
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    logger.error('Failed to create predictive render job in D1', { error, input });
    return null;
  }
}

/**
 * Updates the lifecycle status of a predictive render job.
 */
export async function updateJobStatusInD1(
  jobId: string,
  status: RenderJobStatus,
  actualMcuConsumed?: number,
  earlyHaltProbability?: number,
  haltReason?: string
): Promise<boolean> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for updateJobStatusInD1', { jobId });
    return false;
  }

  const now = Date.now();
  try {
    const stmt = db.prepare(
      `UPDATE growth_predictive_render_jobs
       SET status = ?,
           actual_mcu_consumed = COALESCE(?, actual_mcu_consumed),
           early_halt_probability = COALESCE(?, early_halt_probability),
           halt_reason = COALESCE(?, halt_reason),
           updated_at = ?
       WHERE id = ?`
    );

    const res = await stmt
      .bind(
        status,
        actualMcuConsumed ?? null,
        earlyHaltProbability ?? null,
        haltReason ?? null,
        now,
        jobId
      )
      .run();

    return (res.meta?.changes ?? 0) > 0;
  } catch (error) {
    logger.error('Failed to update predictive render job status', { jobId, status, error });
    return false;
  }
}
