/**
 * SOP Installation Mutations & Claim Operations
 * Updates, schedule advancement, deletion, and due installation claiming.
 */

import { logger } from '@/seed/utils/logger-utility';
import type { SopInstallationRow, SopCustomizations } from './sop-types';

/** Update customizations JSON on an installation */
export async function updateCustomizations(
  db: D1Database,
  id: string,
  customizations: SopCustomizations,
): Promise<void> {
  await db
    .prepare(`UPDATE user_sop_installations SET customizations = ?1 WHERE id = ?2`)
    .bind(JSON.stringify(customizations), id)
    .run();
}

/** Update config_values JSON on an installation */
export async function updateConfigValues(
  db: D1Database,
  id: string,
  configValues: Record<string, unknown>,
): Promise<void> {
  await db
    .prepare(`UPDATE user_sop_installations SET config_values = ?1 WHERE id = ?2`)
    .bind(JSON.stringify(configValues), id)
    .run();
}

/** Enable or disable an installation */
export async function setEnabled(db: D1Database, id: string, enabled: boolean): Promise<void> {
  await db
    .prepare(`UPDATE user_sop_installations SET enabled = ?1 WHERE id = ?2`)
    .bind(enabled ? 1 : 0, id)
    .run();
}

/** Advance the schedule after a successful run */
export async function advanceSchedule(
  db: D1Database,
  id: string,
  lastRunAt: number,
  nextRunAt: number | null,
): Promise<void> {
  await db
    .prepare(
      `UPDATE user_sop_installations
       SET last_run_at = ?1, next_run_at = ?2, run_count = run_count + 1
       WHERE id = ?3`,
    )
    .bind(lastRunAt, nextRunAt, id)
    .run();
}

/** Delete an installation (hard delete) */
export async function deleteInstallation(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`DELETE FROM user_sop_installations WHERE id = ?1`)
    .bind(id)
    .run();
}

/**
 * Claim due installations atomically.
 * Advances next_run_at by 5 min to prevent double-fire on retry.
 * Returns at most `limit` rows that are enabled and past their schedule.
 */
export async function claimDueInstallations(
  db: D1Database,
  now: number,
  limit: number,
): Promise<SopInstallationRow[]> {
  const { results: due } = await db
    .prepare(
      `SELECT * FROM user_sop_installations
       WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?1
       ORDER BY next_run_at ASC
       LIMIT ?2`,
    )
    .bind(now, limit)
    .all<SopInstallationRow>();

  if (due.length === 0) return [];

  // Advance each claimed row (claim-then-execute pattern)
  const claimOffset = 5 * 60;
  for (const inst of due) {
    await db
      .prepare(
        `UPDATE user_sop_installations SET next_run_at = ?1 WHERE id = ?2 AND next_run_at <= ?3`,
      )
      .bind(now + claimOffset, inst.id, now)
      .run();
  }

  logger.debug('[sop-repo] Claimed due installations', { count: due.length });
  return due;
}
