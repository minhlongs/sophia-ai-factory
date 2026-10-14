/**
 * Dunning Email Notification Sender
 * Layer: LAND (Business Domain Workflows)
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  sendDunningDay1Email,
  sendDunningDay3Email,
  sendDunningDay5Email,
} from '@/land/billing/email';
import type { DunningEmailParams } from './types';

/**
 * Send the appropriate dunning email based on attempt number.
 *
 * Mapping:
 *  attempt 1 → dunning_day1 (24h after first decline)
 *  attempt 2 → dunning_day3 (72h after second attempt ≈ day 3)
 *  attempt 3+ → dunning_day5 (final warning before suspension)
 *
 * Looks up user email from the 'user' table (non-fatal: skips if unavailable).
 */
export async function sendDunningEmail(params: DunningEmailParams): Promise<void> {
  const { userId, licenseNonce, tier, amount, currency, failureReason, attemptNumber, settings, nextRetryAt } = params;

  // Fetch user email — required for delivery
  const db = createServerClient();
  const { data: userRow } = await db.from('user').select('email,name').eq('id', userId).single();
  const userEmail = (userRow as { email?: string; name?: string } | null)?.email ?? '';
  const ownerFullName = (userRow as { email?: string; name?: string } | null)?.name ?? '';

  if (!userEmail) {
    logger.warn('[Dunning] No user email — skipping dunning email', { licenseNonce: licenseNonce.slice(0, 8) });
    return;
  }

  const language: 'en' | 'vi' = settings.email_language === 'vi' ? 'vi' : 'en';

  // Calculate suspension date for day-3 / day-5 context
  const gracePeriodMs = settings.grace_period_days * 24 * 60 * 60 * 1000;
  const stateChangedAt = settings.dunning_state_changed_at
    ? new Date(settings.dunning_state_changed_at)
    : new Date();
  const suspensionDate = new Date(stateChangedAt.getTime() + gracePeriodMs);
  const gracePeriodDaysLeft = Math.max(
    0,
    Math.ceil((suspensionDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );

  const emailContext = {
    userId,
    userEmail,
    ownerFullName,
    licenseNonce,
    tier,
    amount,
    currency,
    failureReason,
    nextRetryDate: nextRetryAt,
    suspensionDate,
    gracePeriodDaysLeft,
    language,
  };

  if (attemptNumber === 1) {
    await sendDunningDay1Email(emailContext);
  } else if (attemptNumber === 2) {
    await sendDunningDay3Email(emailContext);
  } else {
    // attempt 3+ → final warning
    await sendDunningDay5Email(emailContext);
  }

  logger.info('[Dunning] Dunning email sent', {
    licenseNonce: licenseNonce.slice(0, 8),
    attemptNumber,
    emailType: attemptNumber === 1 ? 'dunning_day1' : attemptNumber === 2 ? 'dunning_day3' : 'dunning_day5',
  });
}
