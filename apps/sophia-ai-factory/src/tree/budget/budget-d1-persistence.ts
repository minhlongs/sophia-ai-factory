/**
 * @module tree/budget/budget-d1-persistence
 *
 * D1 persistence operations for budget entries.
 * Extracted from BudgetTracker class for file size management.
 *
 * Layer rule: tree — imports seed only.
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { EntryStatus, type BudgetEntry } from './budget-types';

/** KV type key for budget entries in the memory_kv table. */
const BUDGET_KV_TYPE = 'budget' as const;

/**
 * Load all budget entries for a tenant from D1 memory_kv.
 *
 * @param tenantId - Tenant identifier
 * @returns Array of BudgetEntry objects
 */
export async function loadBudgetEntriesFromD1(
  tenantId: string,
): Promise<BudgetEntry[]> {
  const db = await getD1();
  if (!db) {
    logger.warn('[BudgetTracker] D1 client unavailable');
    return [];
  }
  const rows = await db
    .prepare(
      `SELECT key_name, value_json
       FROM memory_kv
       WHERE tenant_id = ?1 AND type = ?2`,
    )
    .bind(tenantId, BUDGET_KV_TYPE)
    .all<{ key_name: string; value_json: string }>();

  const entries: BudgetEntry[] = [];
  for (const row of rows.results ?? []) {
    try {
      const parsed = JSON.parse(row.value_json) as Record<string, unknown>;
      const id = row.key_name.replace(/^entry:/, '');
      entries.push({
        id,
        tenantId: (parsed.tenantId as string) ?? tenantId,
        tool: (parsed.tool as string) ?? 'unknown',
        operation: (parsed.operation as string) ?? 'unknown',
        status: (parsed.status as EntryStatus) ?? EntryStatus.ESTIMATED,
        estimatedUsd: (parsed.estimatedUsd as number) ?? 0,
        reservedUsd: (parsed.reservedUsd as number) ?? 0,
        actualUsd: (parsed.actualUsd as number) ?? 0,
        timestamp: (parsed.timestamp as string) ?? new Date().toISOString(),
      });
    } catch {
      logger.warn('[BudgetTracker] Skipping corrupt entry', {
        keyName: row.key_name,
      });
    }
  }

  return entries;
}

/**
 * Persist a single budget entry to D1 memory_kv (upsert).
 *
 * @param tenantId - Tenant identifier
 * @param entry - Budget entry to persist
 */
export async function persistBudgetEntryToD1(
  tenantId: string,
  entry: BudgetEntry,
): Promise<void> {
  const db = await getD1();
  if (!db) {
    logger.warn('[BudgetTracker] D1 client unavailable, skipping persist');
    return;
  }
  const keyName = `entry:${entry.id}`;
  const valueJson = JSON.stringify({
    tenantId: entry.tenantId,
    tool: entry.tool,
    operation: entry.operation,
    status: entry.status,
    estimatedUsd: entry.estimatedUsd,
    reservedUsd: entry.reservedUsd,
    actualUsd: entry.actualUsd,
    timestamp: entry.timestamp,
  });

  await db
    .prepare(
      `INSERT INTO memory_kv (tenant_id, type, key_name, value_json, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)
       ON CONFLICT(tenant_id, type, key_name)
       DO UPDATE SET value_json = ?4, updated_at = ?5`,
    )
    .bind(
      tenantId,
      BUDGET_KV_TYPE,
      keyName,
      valueJson,
      new Date().toISOString(),
    )
    .run();
}
