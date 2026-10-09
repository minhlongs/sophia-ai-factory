/**
 * User SOP Installation repository functions
 *
 * @module seed/db/repositories/sop/installation-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { UserSopInstallationDbRow } from '@/seed/db/types';

/**
 * List all SOPs installed by a user within a given org.
 * Returns empty array on error.
 */
export async function getUserInstallations(
  userId: string,
  orgId: string,
): Promise<UserSopInstallationDbRow[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const result = await db
      .prepare(
        `SELECT id, user_id, org_id, sop_template_id, config_overrides,
                custom_name, notes, total_runs, total_credits_spent,
                installed_at, last_run_at
         FROM user_sop_installations
         WHERE user_id = ?1 AND org_id = ?2
         ORDER BY installed_at DESC`,
      )
      .bind(userId, orgId)
      .all<UserSopInstallationDbRow>();

    return result.results ?? [];
  } catch (err) {
    logger.error('[SopRepo] getUserInstallations failed', { userId, orgId, error: getErrorMessage(err) });
    return [];
  }
}

/**
 * Install a SOP template for a user.
 * Returns the new installation ID.
 * Throws on constraint violation.
 */
export async function installSop(
  userId: string,
  orgId: string,
  sopTemplateId: string,
): Promise<string> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO user_sop_installations
         (id, user_id, org_id, sop_template_id, total_runs,
          total_credits_spent, installed_at)
       VALUES (?1, ?2, ?3, ?4, 0, 0, ?5)`,
    )
    .bind(id, userId, orgId, sopTemplateId, now)
    .run();

  logger.info('[SopRepo] SOP installed', { id, userId, orgId, sopTemplateId });
  return id;
}

/**
 * Remove a SOP installation by ID.
 * Throws on D1 error; no-op if row does not exist.
 */
export async function uninstallSop(installationId: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  await db
    .prepare(`DELETE FROM user_sop_installations WHERE id = ?1`)
    .bind(installationId)
    .run();

  logger.info('[SopRepo] SOP uninstalled', { installationId });
}
