/**
 * Install Starter SOP for FREE100 / MASTER-tier users.
 *
 * Idempotent — skips insert if the user already has this template installed.
 * Called during auto-handover after user creation.
 *
 * @module tree/handover/install-starter-sop
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

const STARTER_SLUG = 'video-generation-starter';

/**
 * Look up template_id for the starter SOP slug.
 * Returns null when the template row is not yet seeded (safe: install skipped).
 */
async function resolveTemplateId(db: D1Database): Promise<string | null> {
  try {
    const row = await db
      .prepare(`SELECT id FROM sop_templates WHERE slug = ?1 AND status = 'published' LIMIT 1`)
      .bind(STARTER_SLUG)
      .first<{ id: string }>();
    return row?.id ?? null;
  } catch (err) {
    logger.warn('[installStarterSop] resolveTemplateId failed', { error: getErrorMessage(err) });
    return null;
  }
}

/** Check if user already has this template installed (idempotency guard). */
async function alreadyInstalled(db: D1Database, userId: string, templateId: string): Promise<boolean> {
  try {
    const row = await db
      .prepare(`SELECT id FROM user_sop_installations WHERE user_id = ?1 AND template_id = ?2 LIMIT 1`)
      .bind(userId, templateId)
      .first<{ id: string }>();
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Install the "video-generation-starter" SOP template for a new MASTER-tier user.
 * Non-blocking — caller should not await on the error path.
 */
export async function installStarterSop(db: D1Database, userId: string): Promise<void> {
  const templateId = await resolveTemplateId(db);
  if (!templateId) {
    logger.info('[installStarterSop] Template not seeded yet — skipping install', { userId });
    return;
  }

  const exists = await alreadyInstalled(db, userId, templateId);
  if (exists) {
    logger.info('[installStarterSop] Already installed — skipping', { userId, templateId });
    return;
  }

  const id = crypto.randomUUID().replace(/-/g, '');
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO user_sop_installations
         (id, user_id, template_id, enabled, run_count, created_at)
         VALUES (?1, ?2, ?3, 1, 0, ?4)`,
      )
      .bind(id, userId, templateId, nowSec)
      .run();

    logger.info('[installStarterSop] Starter SOP installed', { userId, templateId, installId: id });
  } catch (err) {
    // Non-fatal — log and continue
    logger.warn('[installStarterSop] Insert failed (non-fatal)', { error: getErrorMessage(err) });
  }
}
