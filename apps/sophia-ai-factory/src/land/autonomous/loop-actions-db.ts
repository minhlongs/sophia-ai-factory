/**
 * Autonomous Land Database & Configuration Primitives
 *
 * Layer: land/autonomous (Internal helpers)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module land/autonomous/loop-actions-db
 */

import { getD1Sync } from '@/seed/db/client';
import type {
  AutonomousLoopStateRow,
  AutonomousScheduleTaskRow,
  AutonomousDeadLetterRow,
  AutonomousCycleRunRow,
} from '@/seed/types/autonomous-engine';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface AutonomousCockpitStatus {
  loopState: AutonomousLoopStateRow;
  tasks: AutonomousScheduleTaskRow[];
  recentRuns: AutonomousCycleRunRow[];
  deadLetterTasks: AutonomousDeadLetterRow[];
}

export interface TriggerCycleOptions {
  force?: boolean;
  tenantId?: string;
  availableMcu?: number;
  maxTokensPerCycle?: number;
  dbOverride?: unknown;
}

/**
 * Resolves active D1 database binding.
 */
export function resolveDb(dbOverride?: unknown): D1Database {
  if (dbOverride && typeof (dbOverride as D1Database).prepare === 'function') {
    return dbOverride as D1Database;
  }
  return getD1Sync();
}

/**
 * Helper to ensure a tenant singleton loop state row exists.
 */
export async function ensureTenantLoopState(
  db: D1Database,
  tenantId: string
): Promise<AutonomousLoopStateRow> {
  const existing = await db
    .prepare(
      `SELECT * FROM autonomous_loop_state WHERE tenant_id = ?1 LIMIT 1`
    )
    .bind(tenantId)
    .first<AutonomousLoopStateRow>();

  if (existing) {
    return existing;
  }

  const now = Math.floor(Date.now() / 1000);
  const id = `singleton_${tenantId}`;
  await db
    .prepare(
      `INSERT OR IGNORE INTO autonomous_loop_state (
        id, tenant_id, state, current_cycle_id, consecutive_failures, last_error,
        consciousness_score, daily_mcu_consumed, monthly_mcu_consumed,
        daily_spend_cents, monthly_spend_cents, last_heartbeat_at, version, created_at, updated_at
      ) VALUES (?1, ?2, 'IDLE', NULL, 0, NULL, 100, 0.0, 0.0, 0, 0, ?3, 1, ?4, ?5)`
    )
    .bind(id, tenantId, now, now, now)
    .run();

  const created = await db
    .prepare(
      `SELECT * FROM autonomous_loop_state WHERE tenant_id = ?1 LIMIT 1`
    )
    .bind(tenantId)
    .first<AutonomousLoopStateRow>();

  if (!created) {
    throw new Error(`Failed to initialize loop state for tenant: ${tenantId}`);
  }
  return created;
}
