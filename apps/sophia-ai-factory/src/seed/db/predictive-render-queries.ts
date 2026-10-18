/**
 * Seed Layer: Growth Triad v14 Predictive Render Queries
 * Read queries and row mapping for predictive render jobs.
 * @module seed/db/predictive-render-queries
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  PredictiveRenderJob,
  RenderJobStatus,
} from '@/seed/types/growth-triad-v14';

/**
 * Retrieves the latest predictive render jobs for a given user.
 */
export async function getJobsForUser(
  userId: string,
  limit: number = 20
): Promise<PredictiveRenderJob[]> {
  const db = await getD1();
  if (!db) return [];

  try {
    const stmt = db.prepare(
      `SELECT * FROM growth_predictive_render_jobs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    );

    const res = await stmt.bind(userId, limit).all<Record<string, unknown>>();
    const rows = res.results ?? [];

    return rows.map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      scriptId: String(r.script_id),
      mabArmId: r.mab_arm_id ? String(r.mab_arm_id) : undefined,
      deliberationScore: Number(r.deliberation_score),
      kellyAllocationFraction: Number(r.kelly_allocation_fraction),
      allocatedMcu: Number(r.allocated_mcu),
      actualMcuConsumed: Number(r.actual_mcu_consumed ?? 0),
      status: String(r.status) as RenderJobStatus,
      earlyHaltProbability: r.early_halt_probability !== null ? Number(r.early_halt_probability) : undefined,
      haltReason: r.halt_reason ? String(r.halt_reason) : undefined,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    }));
  } catch (error) {
    logger.error('Failed to fetch user predictive render jobs', { userId, error });
    return [];
  }
}
