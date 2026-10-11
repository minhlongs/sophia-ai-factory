import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { ACCOUNT_DELETE_ORDER } from './types';

/**
 * Fetch the org_id for a tenant using canonical resolveOrgId.
 * Returns null if no row found (already deleted or no org).
 */
export async function fetchOrgId(db: D1Database, userId: string): Promise<string | null> {
  return resolveOrgId(userId, db);
}

/**
 * Executes the D1 cascade deletions in dependents-first order.
 */
export async function executeD1Cascade(
  db: D1Database,
  userId: string,
  tenantId: string,
  orgId: string | null,
): Promise<{ total: number; byTable: Record<string, number> }> {
  const byTable: Record<string, number> = {};
  let total = 0;

  for (const { table, column } of ACCOUNT_DELETE_ORDER) {
    try {
      let bindValue: string;
      switch (column) {
        case 'org_id':
          bindValue = orgId ?? '';
          break;
        case 'creator_id':
        case 'user_id':
          bindValue = userId;
          break;
        case 'tenant_id':
          bindValue = tenantId;
          break;
      }

      const r = await db
        .prepare(`DELETE FROM ${table} WHERE ${column} = ?`)
        .bind(bindValue)
        .run();
      const c = r.meta?.changes ?? r.meta?.rows_written ?? 0;
      byTable[table] = c;
      total += c;
    } catch {
      // Per-table failure non-fatal: cron retry / manual call picks up next pass.
      byTable[table] = 0;
    }
  }

  return { total, byTable };
}

/**
 * Cleanup cooldown row regardless of cascade outcome
 * (so it doesn't loop on subsequent cron passes).
 */
export async function cleanupCooldownRow(db: D1Database, userId: string): Promise<void> {
  try {
    await db
      .prepare(`DELETE FROM account_deletion_requests WHERE user_id = ?`)
      .bind(userId)
      .run();
  } catch {
    /* non-fatal */
  }
}

/**
 * Logs failing R2 keys to audit_log dead-letter queue.
 */
export async function logR2DeadLetter(
  db: D1Database,
  userId: string,
  tenantId: string,
  failedKeys: string[],
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO audit_log (action_type, target_user_id, payload, created_at)
         VALUES ('r2_deletion_dead_letter', ?1, ?2, ?3)`,
      )
      .bind(
        userId,
        JSON.stringify({ tenantId, failedKeys }),
        new Date().toISOString(),
      )
      .run();
  } catch (dlqErr) {
    logger.warn('[cascade-delete] Failed to record R2 DLQ entry to audit_log (non-fatal)', {
      userId,
      error: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
    });
  }
}
