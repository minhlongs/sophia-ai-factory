/**
 * Installation context lookup and counter update helpers for SOP Execution Repository.
 * @module seed/sop/sop-repo-runs-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function genId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/** Look up user_id, org_id, sop_template_id from an installation */
export async function resolveInstallationContext(
  db: D1Database,
  installationId: string,
): Promise<{ userId: string; orgId: string; templateId: string }> {
  const row = await db
    .prepare(
      `SELECT user_id, template_id FROM user_sop_installations WHERE id = ?1 LIMIT 1`,
    )
    .bind(installationId)
    .first<{ user_id: string; template_id: string }>();

  if (!row) {
    throw new Error(`resolveInstallationContext: installation not found: ${installationId}`);
  }

  return { userId: row.user_id, orgId: row.user_id, templateId: row.template_id };
}

/**
 * Best-effort increment of the cached `total_runs` counter on `user_sop_installations`.
 */
export async function incrementSopRunCount(db: D1Database, installationId: string): Promise<void> {
  try {
    await db
      .prepare(
        `UPDATE user_sop_installations SET total_runs = total_runs + 1 WHERE id = ?1`,
      )
      .bind(installationId)
      .run();
  } catch (err) {
    logger.warn('[SopRepo] incrementSopRunCount failed', {
      installationId,
      error: getErrorMessage(err),
    });
  }
}
