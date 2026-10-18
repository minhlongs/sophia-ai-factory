/**
 * Handover welcome email delivery helper for POST /api/welcome/resend.
 * @module app/api/welcome/resend/welcome-resend-delivery
 */

import { sendAutoHandoverWelcomeEmail, sendWelcomeEmail } from '@/tree/handover/handover-email-service';
import { generateHandoverDoc } from '@/tree/handover/handover-doc-generator';
import { logger } from '@/seed/utils/logger-utility';
import type { CustomerHandoverRow, AgencyType } from '@/tree/handover/handover-types';
import type { Tier } from '@/seed/types';

export interface DeliverHandoverEmailInput {
  db: D1Database;
  userRow: { id: string; email: string; name: string };
  handover: CustomerHandoverRow;
  magicLinkUrl: string;
}

/**
 * Sends the appropriate welcome email (auto_signup/auto_payment vs manual handover)
 * and updates `welcome_email_sent_at` on success.
 */
export async function deliverHandoverWelcomeEmail({
  db,
  userRow,
  handover,
  magicLinkUrl,
}: DeliverHandoverEmailInput): Promise<boolean> {
  let emailOk = false;
  try {
    if (handover.source === 'auto_signup' || handover.source === 'auto_payment') {
      await sendAutoHandoverWelcomeEmail({
        toEmail: userRow.email,
        ownerFullName: userRow.name,
        tier: handover.tier as Tier,
        locale: 'vi',
        magicLinkUrl,
      });
      emailOk = true;
    } else {
      const installedSops: string[] = handover.starter_sops
        ? (JSON.parse(handover.starter_sops) as string[])
        : [];
      const docMarkdown = generateHandoverDoc({
        customerId: handover.customer_user_id,
        agencyName: handover.agency_name,
        ownerFullName: userRow.name,
        ownerEmail: userRow.email,
        tier: handover.tier as Tier,
        agencyType: (handover.agency_type ?? 'other') as AgencyType,
        locale: 'vi',
        installedSops,
        magicLinkUrl,
        contractDate: new Date(handover.created_at * 1000).toISOString().split('T')[0],
      });
      const r = await sendWelcomeEmail({
        toEmail: userRow.email,
        ownerFullName: userRow.name,
        agencyName: handover.agency_name,
        tier: handover.tier as Tier,
        magicLinkUrl,
        locale: 'vi',
        handoverMarkdown: docMarkdown,
      });
      emailOk = r.success;
    }

    if (emailOk) {
      await db
        .prepare(`UPDATE customer_handovers SET welcome_email_sent_at = ?1 WHERE id = ?2`)
        .bind(Math.floor(Date.now() / 1000), handover.id)
        .run();
    }
  } catch (err) {
    logger.warn('[Welcome/Resend] Email send failed (still 200)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return emailOk;
}
