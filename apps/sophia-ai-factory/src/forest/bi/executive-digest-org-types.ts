/**
 * Types and recipient helpers for Executive BI Digest Organization Runner.
 * @module forest/bi/executive-digest-org-types
 */

import type { D1Database } from '@/seed/db/client';
import type { TelegramConfig } from '@/forest/bi/telegram-digest-sender';

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

export async function resolveDigestRecipientEmails(
  db: D1Database,
  orgId: string,
  explicitEmails?: string[],
): Promise<string[]> {
  if (explicitEmails && explicitEmails.length > 0) {
    return explicitEmails;
  }
  const { results: members } = await db
    .prepare(
      `SELECT email FROM org_invitations
       WHERE org_id = ?1 AND role IN ('owner', 'admin') AND status = 'accepted'
       LIMIT 5`,
    )
    .bind(orgId)
    .all<{ email: string }>();

  if (members && members.length > 0) {
    return members.map((m) => m.email).filter(Boolean);
  }
  return [];
}
