/**
 * Mission Repository Status and Spend Mutation Operations
 *
 * Layer: tree/mission
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { Mission, CreativeMissionStatus } from '@/seed/types/creative-economy';
import { MissionError, canTransition } from '../types';
import { getMission } from './crud-operations';

export async function updateMissionStatus(
  id: string,
  newStatus: CreativeMissionStatus,
  currentPhase: string,
  workspaceId?: string,
): Promise<Mission> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  const existing = await getMission(id);
  if (!existing) throw new MissionError('NOT_FOUND', `Mission ${id} not found`);
  if (workspaceId && existing.workspaceId !== workspaceId) {
    throw new MissionError('FORBIDDEN', `Mission ${id} does not belong to workspace ${workspaceId}`);
  }
  if (!canTransition(existing.status, newStatus)) {
    throw new MissionError('INVALID_TRANSITION', `${existing.status} → ${newStatus} not allowed`);
  }
  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(`UPDATE creative_missions SET status = ?, current_phase = ?, updated_at = ? WHERE id = ? AND status = ?`)
    .bind(newStatus, currentPhase, now, id, existing.status)
    .run();
  if (result.meta.changes === 0) {
    throw new MissionError('CONCURRENT_MODIFICATION', `Mission ${id} status changed concurrently`);
  }
  const updated = await getMission(id);
  if (!updated) throw new MissionError('UPDATE_FAILED', 'Fetch after update failed');
  return updated;
}

export async function recordSpend(id: string, amountCents: number, workspaceId?: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new MissionError('D1_UNAVAILABLE', 'D1 not available');
  if (workspaceId) {
    const existing = await getMission(id);
    if (!existing) throw new MissionError('NOT_FOUND', `Mission ${id} not found`);
    if (existing.workspaceId !== workspaceId) {
      throw new MissionError('FORBIDDEN', `Mission ${id} does not belong to workspace ${workspaceId}`);
    }
  }
  await db
    .prepare(`UPDATE creative_missions SET spent_cents = spent_cents + ?, updated_at = ? WHERE id = ?`)
    .bind(amountCents, Math.floor(Date.now() / 1000), id)
    .run();

  // ── SIDE-CHANNEL: mission.cost_recorded (Q4 economics, non-fatal) ──────
  // Mirrors recordNodePerformance: never throws into the caller, never
  // enters the runner's deterministic checkpoint stream. Reads the new
  // total + workspace_id so the event carries allowlisted totals only.
  try {
    const { emitMissionCostRecorded } = await import('@/tree/performance/loop-emitters-cost');
    const row = await db
      .prepare(`SELECT workspace_id, budget_cents, spent_cents FROM creative_missions WHERE id = ?1 LIMIT 1`)
      .bind(id)
      .first<{ workspace_id: string; budget_cents: number; spent_cents: number }>();
    if (row) {
      await emitMissionCostRecorded({
        workspaceId: row.workspace_id,
        missionId: id,
        amountCents,
        totalSpentCents: row.spent_cents ?? 0,
        budgetCents: row.budget_cents ?? 0,
        recordedAt: Date.now(),
      });
    }
  } catch (err) {
    // Non-fatal: cost telemetry must never abort a spend write.
    logger.warn('[repository.recordSpend] cost event emit failed (non-fatal)', {
      missionId: id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
