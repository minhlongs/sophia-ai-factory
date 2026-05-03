/**
 * SOP Installation Repository
 * CRUD for user_sop_installations: create, toggle, schedule, claim, delete.
 */

import { logger } from '@/lib/utils/logger-utility';
import type { SopInstallationRow, CreateInstallationInput, SopCustomizations } from './sop-types';

function nowSec(): number { return Math.floor(Date.now() / 1000); }
function genId(): string { return crypto.randomUUID().replace(/-/g, ''); }

/** List all installations for a user */
export async function listInstallationsForUser(db: D1Database, userId: string): Promise<SopInstallationRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM user_sop_installations WHERE user_id = ?1 ORDER BY created_at DESC`)
    .bind(userId)
    .all<SopInstallationRow>();
  return results;
}

/** Get a single installation by ID */
export async function getInstallation(db: D1Database, id: string): Promise<SopInstallationRow | null> {
  const row = await db
    .prepare(`SELECT * FROM user_sop_installations WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<SopInstallationRow>();
  return row ?? null;
}

/** Create a new installation */
export async function createInstallation(
  db: D1Database,
  input: CreateInstallationInput,
): Promise<SopInstallationRow> {
  const id = genId();
  const ts = nowSec();
  const customizationsJson = input.customizations ? JSON.stringify(input.customizations) : null;
  const scheduleCron = input.scheduleCron ?? null;
  const configValuesJson = input.configValues ? JSON.stringify(input.configValues) : null;

  await db
    .prepare(
      `INSERT INTO user_sop_installations
       (id, user_id, template_id, customizations, config_values, schedule_cron, enabled, last_run_at, next_run_at, run_count, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, NULL, NULL, 0, ?7)`,
    )
    .bind(id, input.userId, input.templateId, customizationsJson, configValuesJson, scheduleCron, ts)
    .run();

  const row = await getInstallation(db, id);
  if (!row) throw new Error(`createInstallation: row not found after insert: ${id}`);
  return row;
}

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
