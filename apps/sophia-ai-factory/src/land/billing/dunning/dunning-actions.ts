/**
 * Dunning Actions — Payment Handlers
 *
 * Handles payment failure and success events.
 * Types and DB helper extracted to dunning-attempt-recorder.ts
 *
 * @module billing/dunning/dunning-actions
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  DUNNING_TIER_CONFIGS,
  getDunningSettings,
  getDunningState,
  transitionDunningState,
  calculateNextRetry,
  determineNewState,
  type DunningState,
  type DunningStateResult,
  type DunningSettingsRow,
} from './dunning-state-machine';
import {
  recordDunningAttempt,
  type DunningAttemptRow,
  type PaymentFailureContext,
  type PaymentSuccessContext,
} from './dunning-attempt-recorder';
import {
  sendDunningDay1Email,
  sendDunningDay3Email,
  sendDunningDay5Email,
} from '@/land/billing/email';

export type { DunningAttemptRow, PaymentFailureContext, PaymentSuccessContext } from './dunning-attempt-recorder';

/** Handle payment failure - core dunning logic */
export async function handlePaymentFailure(context: PaymentFailureContext): Promise<DunningStateResult> {
  const { userId, licenseNonce, tier, amount, currency, failureReason, paymentProvider } = context;

  try {
    const tierConfig = DUNNING_TIER_CONFIGS[tier];
    const db = createServerClient();

    let settings = await getDunningSettings(licenseNonce);
    if (!settings) {
      const { data: newSettings, error } = await db
        .from('dunning_settings')
        .insert({
          user_id: userId,
          license_nonce: licenseNonce,
          grace_period_days: tierConfig.gracePeriodDays,
          max_retry_attempts: tierConfig.maxRetryAttempts,
          retry_schedule: tierConfig.retryIntervals.map(d => `${d} days`),
          dunning_state: 'current',
        })
        .select()
        .single();

      if (error || !newSettings) throw new Error(`Failed to initialize dunning settings: ${error?.message}`);
      settings = newSettings as unknown as DunningSettingsRow;
    }

    const { count: recentFailures } = await db
      .from('dunning_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('license_nonce', licenseNonce)
      .eq('success', false)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const attemptNumber = (recentFailures || 0) + 1;
    const newState = determineNewState(settings.dunning_state, attemptNumber, tierConfig);
    const nextRetryAt = calculateNextRetry(attemptNumber, tierConfig);

    await recordDunningAttempt({
      user_id: userId, license_nonce: licenseNonce, attempt_number: attemptNumber,
      attempt_type: 'invoice_payment', payment_provider: paymentProvider, success: false,
      amount, currency, failure_reason: failureReason,
      provider_response_id: context.stripeInvoiceId || null,
      dunning_state_before: settings.dunning_state, dunning_state_after: newState,
      next_retry_at: nextRetryAt.toISOString(), scheduled_retry_count: attemptNumber,
      stripe_invoice_id: context.stripeInvoiceId || null,
      ip_address: context.ipAddress, user_agent: context.userAgent,
    });

    if (newState !== settings.dunning_state) await transitionDunningState(licenseNonce, userId, newState);

    await db.from('billing_events').insert({
      user_id: userId, license_nonce: licenseNonce, event_type: 'payment_failed',
      event_category: 'payment', event_data: { amount, currency, failure_reason: failureReason, attempt_number: attemptNumber, tier },
      amount, currency, payment_provider: paymentProvider,
      provider_event_id: context.stripeInvoiceId,
    });

    // Send time-boxed dunning email (non-fatal — never block the payment pipeline)
    void sendDunningEmail({
      userId, licenseNonce, tier: tier as string, amount, currency,
      failureReason, attemptNumber, settings, nextRetryAt,
    }).catch(err => logger.warn('[Dunning] Email send failed (non-fatal)', toError(err)));

    logger.info('[Dunning] Payment failure handled', { licenseNonce: licenseNonce.slice(0, 8), amount, attemptNumber, newState });
    return getDunningState(licenseNonce);
  } catch (error) {
    logger.error('[Dunning] Failed to handle payment failure', toError(error));
    throw error;
  }
}

// -------------------------------------------------------------------------
// Internal email helper
// -------------------------------------------------------------------------

interface DunningEmailParams {
  userId: string;
  licenseNonce: string;
  tier: string;
  amount: number;
  currency: string;
  failureReason: string;
  attemptNumber: number;
  settings: DunningSettingsRow;
  nextRetryAt: Date;
}

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
async function sendDunningEmail(params: DunningEmailParams): Promise<void> {
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

  const language: 'en' | 'vi' = (settings.email_language === 'vi') ? 'vi' : 'en';

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

/** Handle payment success - restore account to current */
export async function handlePaymentSuccess(context: PaymentSuccessContext): Promise<DunningStateResult> {
  const { userId, licenseNonce, tier, amount, currency, paymentProvider, providerChargeId } = context;

  try {
    const db = createServerClient();
    const currentSettings = await getDunningSettings(licenseNonce);
    const oldState = currentSettings?.dunning_state || 'current';

    await recordDunningAttempt({
      user_id: userId, license_nonce: licenseNonce, attempt_number: 1,
      attempt_type: 'payment_succeeded', payment_provider: paymentProvider, success: true,
      amount, currency, failure_reason: null, provider_response_id: providerChargeId,
      dunning_state_before: oldState, dunning_state_after: 'current',
      next_retry_at: null, scheduled_retry_count: 0,
      stripe_invoice_id: context.providerInvoiceId || null,
    } as Omit<DunningAttemptRow, 'id' | 'created_at'>);

    if (oldState !== 'current') await transitionDunningState(licenseNonce, userId, 'current');

    await db.from('billing_events').insert({
      user_id: userId, license_nonce: licenseNonce, event_type: 'payment_succeeded',
      event_category: 'payment', event_data: { amount, currency, charge_id: providerChargeId, tier },
      amount, currency, payment_provider: paymentProvider,
      provider_event_id: providerChargeId, provider_charge_id: providerChargeId,
      processed: true, processed_at: new Date().toISOString(),
    });

    logger.info('[Dunning] Payment success handled', { licenseNonce: licenseNonce.slice(0, 8), amount, oldState });
    return getDunningState(licenseNonce);
  } catch (error) {
    logger.error('[Dunning] Failed to handle payment success', toError(error));
    throw error;
  }
}
