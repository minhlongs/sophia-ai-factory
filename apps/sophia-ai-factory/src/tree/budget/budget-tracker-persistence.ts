/**
 * D1 persistence and rounding helpers for BudgetTracker.
 * @module tree/budget/budget-tracker-persistence
 */

import { getD1Sync } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { BudgetEntry } from './budget-types';

/** Round a number to 4 decimal places. */
export function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

export function newBudgetEntryId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function persistBudgetEntryToD1(tenantId: string, entry: BudgetEntry): void {
  try {
    let db = null;
    try {
      db = getD1Sync();
    } catch {
      return;
    }
    if (!db) return;
    const keyName = `entry:${entry.id}`;
    const valueJson = JSON.stringify(entry);
    const now = Date.now();
    db.prepare(
      `INSERT INTO memory_kv (id, tenant_id, type, key_name, value_json, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(tenant_id, type, key_name) DO UPDATE SET value_json = ?5, updated_at = ?7`,
    )
      .bind(crypto.randomUUID(), tenantId, 'budget', keyName, valueJson, now, now)
      .run();
  } catch (err) {
    logger.error('[BudgetTracker] persistEntry failed', {
      entryId: entry.id,
      error: getErrorMessage(err),
    });
  }
}
