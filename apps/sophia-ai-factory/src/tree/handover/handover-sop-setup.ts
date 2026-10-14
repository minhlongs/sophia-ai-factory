/**
 * SOP installation and handover record helpers for customer handover creation.
 * @module tree/handover/handover-sop-setup
 */

import { logger } from '@/seed/utils/logger-utility';

function genId(): string {
  return crypto.randomUUID().replace(/-/g, '');
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
            `INSERT OR IGNORE INTO user_sop_installations (id, user_id, template_id, enabled, run_count, created_at)
             VALUES (?1, ?2, ?3, 0, 0, ?4)`,
          )
          .bind(installId, userId, template.id, nowSec)
          .run();
        installed.push(slug);
      }
    } catch (err) {
      logger.warn('[HandoverSetup] SOP install skipped', { slug, err: err instanceof Error ? err.message : String(err) });
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
    source?: 'manual' | 'auto_payment' | 'auto_signup';
    triggerPaymentId?: string | null;
  },
): Promise<string> {
  const handoverId = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  const source = params.source ?? 'manual';
  const triggerPaymentId = params.triggerPaymentId ?? null;
  await db
    .prepare(
      `INSERT INTO customer_handovers
       (id, customer_user_id, agency_name, agency_type, tier, starter_sops, created_by_admin_id, created_at, status, source, trigger_payment_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending', ?9, ?10)`,
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
      source,
      triggerPaymentId,
    )
    .run();
  return handoverId;
}
