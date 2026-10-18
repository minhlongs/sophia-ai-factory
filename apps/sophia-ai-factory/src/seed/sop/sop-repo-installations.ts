/**
 * SOP Installation Repository
 * CRUD for user_sop_installations: create, toggle, schedule, claim, delete.
 */

import { assertTemplateInstallable } from '@/seed/sop/sop-marketplace-guard';
import type { SopInstallationRow, CreateInstallationInput } from './sop-types';
import {
  updateCustomizations,
  updateConfigValues,
  setEnabled,
  advanceSchedule,
  deleteInstallation,
  claimDueInstallations,
} from './sop-repo-installation-mutations';

export {
  updateCustomizations,
  updateConfigValues,
  setEnabled,
  advanceSchedule,
  deleteInstallation,
  claimDueInstallations,
};

function nowSec(): number { return Math.floor(Date.now() / 1000); }
function genId(): string { return crypto.randomUUID().replace(/-/g, ''); }

/** List all installations for a user */
export async function listInstallationsForUser(db: D1Database, userId: string): Promise<SopInstallationRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM user_sop_installations WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 100`)
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
  // Fail-closed gate: block paid marketplace SOP templates from install
  await assertTemplateInstallable(db, input.templateId);

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

  // Stamp customer_first_sop_install_at so handover drop-off metrics work.
  // Idempotent + non-fatal — never blocks an install.
  try {
    await db
      .prepare(
        `UPDATE customer_handovers
         SET customer_first_sop_install_at = COALESCE(customer_first_sop_install_at, ?1)
         WHERE customer_user_id = ?2`,
      )
      .bind(ts, input.userId)
      .run();
  } catch {
    // Non-fatal — never block an install
  }

  return row;
}
