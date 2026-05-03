/**
 * Account and SOP setup helpers for handover creation.
 * Extracted from create/route for file size compliance.
 * @module lib/handover/handover-account-setup
 */

import { logger } from '@/lib/utils/logger-utility';
import { getErrorMessage } from '@/lib/utils/to-error';

function genId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function randomPassword(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/** Create a new user in D1. Returns userId or throws. */
export async function createCustomerUser(
  db: D1Database,
  email: string,
  fullName: string,
): Promise<string> {
  const userId = genId();
  const tempPassword = randomPassword();
  const nowSec = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO users (id, email, name, password, role, email_verified, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'customer', 1, ?5, ?5)`,
    )
    .bind(userId, email, fullName, tempPassword, nowSec)
    .run();

  return userId;
}

/** Upsert subscription tier for a user. */
export async function upsertUserTier(
  db: D1Database,
  userId: string,
  tier: string,
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `INSERT OR REPLACE INTO subscriptions (user_id, tier, status, created_at, updated_at)
         VALUES (?1, ?2, 'active', ?3, ?3)`,
      )
      .bind(userId, tier, nowSec)
      .run();
  } catch (err) {
    logger.error('[HandoverSetup] Subscription upsert failed', err instanceof Error ? err : undefined);
  }
}

/** Pre-install SOPs for a user (enabled=0 until keys configured). Returns installed slugs. */
export async function preInstallSops(
  db: D1Database,
  userId: string,
  sopSlugs: string[],
): Promise<string[]> {
  const installed: string[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  for (const slug of sopSlugs) {
    try {
      const template = await db
        .prepare(`SELECT id FROM sop_templates WHERE slug = ?1 AND status = 'published' LIMIT 1`)
        .bind(slug)
        .first<{ id: string }>();

      if (template) {
        const installId = genId();
        await db
          .prepare(
            `INSERT OR IGNORE INTO user_sop_installations
             (id, user_id, template_id, enabled, run_count, created_at)
             VALUES (?1, ?2, ?3, 0, 0, ?4)`,
          )
          .bind(installId, userId, template.id, nowSec)
          .run();
        installed.push(slug);
      }
    } catch (err) {
      logger.warn('[HandoverSetup] SOP install skipped', { slug, err: getErrorMessage(err) });
    }
  }

  return installed;
}

/** Insert handover record. Returns handoverId. */
export async function createHandoverRecord(
  db: D1Database,
  params: {
    userId: string;
    agencyName: string;
    agencyType: string;
    tier: string;
    installedSops: string[];
    adminId: string;
  },
): Promise<string> {
  const handoverId = genId();
  const nowSec = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO customer_handovers
       (id, customer_user_id, agency_name, agency_type, tier, starter_sops, created_by_admin_id, created_at, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending')`,
    )
    .bind(
      handoverId,
      params.userId,
      params.agencyName,
      params.agencyType,
      params.tier,
      JSON.stringify(params.installedSops),
      params.adminId,
      nowSec,
    )
    .run();

  return handoverId;
}
