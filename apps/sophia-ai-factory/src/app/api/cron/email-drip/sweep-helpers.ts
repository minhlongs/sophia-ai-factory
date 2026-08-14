/**
 * Shared dedup-check + enqueue + log pattern for all email-drip sweeps.
 * @module app/api/cron/email-drip/sweep-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { enqueueWelcomeEmail } from '@/tree/email/outbox';
import type { EmailDecision } from './email-drip-types';

/**
 * For a given user, evaluate email decisions, dedup against lifecycle_email_log,
 * enqueue new emails, and insert log rows. Returns count enqueued.
 */
export async function processDecisions(
  db: D1Database,
  userId: string,
  email: string,
  decisions: EmailDecision[],
  nowSec: number,
  sweepLabel: string,
): Promise<number> {
  let enqueued = 0;

  for (const decision of decisions) {
    try {
      const existing = await db
        .prepare(`SELECT 1 FROM lifecycle_email_log WHERE user_id = ?1 AND template = ?2 LIMIT 1`)
        .bind(userId, decision.template)
        .first<{ 1: number }>();
      if (existing) continue;

      const uniqueId = `lifecycle_${userId}_${decision.template}`;
      await enqueueWelcomeEmail(db, {
        paymentId: uniqueId,
        toEmail: email,
        template: decision.template as 'welcome-magic-link',
        payload: decision.payload,
      });

      await db
        .prepare(`INSERT OR IGNORE INTO lifecycle_email_log (user_id, template, sent_at) VALUES (?1,?2,?3)`)
        .bind(userId, decision.template, nowSec)
        .run();

      enqueued++;
    } catch (e) {
      logger.error(`[email-drip] ${sweepLabel} failed for ${userId}`, toError(e));
    }
  }

  return enqueued;
}
