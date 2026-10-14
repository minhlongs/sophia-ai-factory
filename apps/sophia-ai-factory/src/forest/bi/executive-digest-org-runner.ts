/**
 * Per-organization digest delivery runner and types for Executive BI Digest Dispatcher.
 * @module forest/bi/executive-digest-org-runner
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

export async function dispatchDigestForOrganization(params: {
  db: D1Database;
  org: { id: string; name: string };
  cadence: 'weekly' | 'monthly';
  periodStart: number;
  periodEnd: number;
  options: DispatchExecutiveDigestOptions;
  receipt: DigestDeliveryReceipt;
}): Promise<void> {
  const { db, org, cadence, periodStart, periodEnd, options, receipt } = params;
  let tgSuccess = false;
  let emailSuccess = false;
  let orgError: string | undefined;

  try {
    const metrics = await aggregateExecutiveBIMetrics(db, org.id, {
      start: periodStart,
      end: periodEnd,
    });

    const branding: Partial<BrandingSettings> = {
      agencyName: org.name,
    };

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

    let recipientEmails = options.recipientEmails ?? [];
    if (recipientEmails.length === 0) {
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
