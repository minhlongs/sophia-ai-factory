/**
 * Autonomous Loop Database Helpers
 * Land Layer - D1 client resolution and tenant state initialization
 *
 * @module land/autonomous/loop-actions-db
 */

import { createServerClient } from '@/seed/db/client';
import type { AutonomousLoopStateRow } from '@/seed/types/autonomous-engine';

/**
 * Resolves active D1 database binding using createServerClient() (synchronous).
 */
export function resolveDb(dbOverride?: unknown): D1Database {
  if (dbOverride && typeof (dbOverride as D1Database).prepare === 'function') {
    if (
      'unwrap' in (dbOverride as Record<string, unknown>) &&
      typeof (dbOverride as { unwrap: () => D1Database }).unwrap === 'function'
    ) {
      return (dbOverride as { unwrap: () => D1Database }).unwrap();
    }
    return dbOverride as D1Database;
  }
  return createServerClient().unwrap();
}

/**
 * Ensures a tenant singleton loop state row exists in D1.
 */
export async function ensureTenantLoopState(
  db: D1Database,
  tenantId: string,
): Promise<AutonomousLoopStateRow> {
  const existing = await db
    .prepare(
      'SELECT * FROM autonomous_loop_state WHERE tenant_id = ?1 LIMIT 1',
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
      ) VALUES (?1, ?2, 'IDLE', NULL, 0, NULL, 100, 0.0, 0.0, 0, 0, ?3, 1, ?4, ?5)`,
    )
    .bind(id, tenantId, now, now, now)
    .run();

  const created = await db
    .prepare(
      'SELECT * FROM autonomous_loop_state WHERE tenant_id = ?1 LIMIT 1',
    )
    .bind(tenantId)
    .first<AutonomousLoopStateRow>();

  if (!created) {
    throw new Error(`Failed to initialize loop state for tenant: ${tenantId}`);
  }

  return created;
}
