/**
 * Executive BI Digest Dispatcher Orchestrator
 *
 * Implements the contract in PROJECT.md:89-91:
 * dispatchExecutiveDigest(db: D1Database, cadence: 'weekly' | 'monthly', options?: DispatchExecutiveDigestOptions): Promise<DigestDeliveryReceipt>
 *
 * Aggregates analytical metrics per organization and coordinates dual-channel delivery
 * (Resend Email + Telegram Bot) with full multi-tenant isolation.
 *
 * Layer: forest (side-effect orchestrator)
 * Allowed imports: @/seed/*, @/tree/*, @/forest/*
 *
 * @module forest/bi/executive-digest-dispatcher
 */

import type { D1Database } from '@/seed/db/client';
import { aggregateExecutiveBIMetrics } from '@/tree/bi/metrics-aggregator';
import {
  sendTelegramExecutiveDigest,
  type TelegramConfig,
} from '@/forest/bi/telegram-digest-sender';
import { sendEmailExecutiveDigest } from '@/forest/bi/email-digest-sender';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';

export interface DispatchExecutiveDigestOptions {
  orgId?: string;
  telegramConfig?: TelegramConfig;
  resendApiKey?: string;
  recipientEmails?: string[];
}

export interface DigestDeliveryReceipt {
  cadence: 'weekly' | 'monthly';
  executedAt: number;
  periodStart: number;
  periodEnd: number;
  totalOrgs: number;
  telegramDeliveries: {
    attempted: number;
    succeeded: number;
    failed: number;
  };
  emailDeliveries: {
    attempted: number;
    succeeded: number;
    failed: number;
  };
  details: Array<{
    orgId: string;
    telegramSuccess: boolean;
    emailSuccess: boolean;
    error?: string;
  }>;
}

/**
 * Coordinates automated executive digest generation and multi-channel delivery across organizations.
 */
export async function dispatchExecutiveDigest(
  db: D1Database,
  cadence: 'weekly' | 'monthly' = 'weekly',
  options: DispatchExecutiveDigestOptions = {},
): Promise<DigestDeliveryReceipt> {
  const now = Date.now();
  const periodDuration = cadence === 'weekly' ? 7 * 86400 * 1000 : 30 * 86400 * 1000;
  const periodStart = now - periodDuration;
  const periodEnd = now;

  let orgsQuery = `SELECT id, name, slug, tier FROM organizations WHERE status = 'active'`;
  const queryParams: unknown[] = [];

  if (options.orgId) {
    orgsQuery += ` AND id = ?1`;
    queryParams.push(options.orgId.trim());
  }

  const { results: orgs } = await db
    .prepare(orgsQuery)
    .bind(...queryParams)
    .all<{ id: string; name: string; slug: string; tier: string }>();

  const receipt: DigestDeliveryReceipt = {
    cadence,
    executedAt: now,
    periodStart,
    periodEnd,
    totalOrgs: orgs?.length ?? 0,
    telegramDeliveries: { attempted: 0, succeeded: 0, failed: 0 },
    emailDeliveries: { attempted: 0, succeeded: 0, failed: 0 },
    details: [],
  };

  if (!orgs || orgs.length === 0) {
    return receipt;
  }

  for (const org of orgs) {
    let tgSuccess = false;
    let emailSuccess = false;
    let orgError: string | undefined;

    try {
      // 1. Aggregate metrics strictly within org tenant scope
      const metrics = await aggregateExecutiveBIMetrics(db, org.id, {
        start: periodStart,
        end: periodEnd,
      });

      const branding: Partial<BrandingSettings> = {
        agencyName: org.name,
      };

      // 2. Dispatch Telegram digest
      receipt.telegramDeliveries.attempted++;
      const tgResult = await sendTelegramExecutiveDigest(
        options.telegramConfig ?? {},
        metrics,
        branding,
      );
      if (tgResult.success || tgResult.skipped) {
        receipt.telegramDeliveries.succeeded++;
        tgSuccess = true;
      } else {
        receipt.telegramDeliveries.failed++;
        orgError = tgResult.error;
      }

      // 3. Dispatch Email digest
      // Resolve recipient emails
      let recipientEmails = options.recipientEmails ?? [];
      if (recipientEmails.length === 0) {
        // Query org owners / admins
        const { results: members } = await db
          .prepare(
            `SELECT email FROM org_invitations
             WHERE org_id = ?1 AND role IN ('owner', 'admin') AND status = 'accepted'
             LIMIT 5`,
          )
          .bind(org.id)
          .all<{ email: string }>();

        if (members && members.length > 0) {
          recipientEmails = members.map((m) => m.email).filter(Boolean);
        }
      }

      if (recipientEmails.length > 0) {
        receipt.emailDeliveries.attempted += recipientEmails.length;
        for (const recipientEmail of recipientEmails) {
          const emailRes = await sendEmailExecutiveDigest(
            options.resendApiKey,
            recipientEmail,
            metrics,
            branding,
            { cadence },
          );
          if (emailRes.success || emailRes.provider === 'dry-run') {
            receipt.emailDeliveries.succeeded++;
            emailSuccess = true;
          } else {
            receipt.emailDeliveries.failed++;
            orgError = orgError ? `${orgError}; ${emailRes.error}` : emailRes.error;
          }
        }
      } else {
        // In dev or test environments with no recipients configured, mark as skipped success
        emailSuccess = true;
      }
    } catch (err) {
      orgError = getErrorMessage(err);
      logger.error('[executive-digest-dispatcher] Error processing org digest', {
        orgId: org.id,
        error: orgError,
      });
    }

    receipt.details.push({
      orgId: org.id,
      telegramSuccess: tgSuccess,
      emailSuccess,
      error: orgError,
    });
  }

  return receipt;
}
