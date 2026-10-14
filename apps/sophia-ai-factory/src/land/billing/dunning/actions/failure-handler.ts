/**
 * Payment Failure Action Handler
 * Layer: LAND (Business Domain Workflows)
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
  type DunningStateResult,
  type DunningSettingsRow,
} from '../dunning-state-machine';
import {
  recordDunningAttempt,
  type PaymentFailureContext,
} from '../dunning-attempt-recorder';
import { invalidateDunningCache } from '../dunning-kv-cache';
import { sendDunningEmail } from './email-sender';

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
      user_id: userId,
      license_nonce: licenseNonce,
      attempt_number: attemptNumber,
      attempt_type: 'invoice_payment',
      payment_provider: paymentProvider,
      success: false,
      amount,
      currency,
      failure_reason: failureReason,
      provider_response_id: context.stripeInvoiceId || null,
      dunning_state_before: settings.dunning_state,
      dunning_state_after: newState,
      next_retry_at: nextRetryAt.toISOString(),
      scheduled_retry_count: attemptNumber,
      stripe_invoice_id: context.stripeInvoiceId || null,
      ip_address: context.ipAddress,
      user_agent: context.userAgent,
    });

    if (newState !== settings.dunning_state) {
      await transitionDunningState(licenseNonce, userId, newState);
      await invalidateDunningCache(licenseNonce);
    }

    await db.from('billing_events').insert({
      user_id: userId,
      license_nonce: licenseNonce,
      event_type: 'payment_failed',
      event_category: 'payment',
      event_data: { amount, currency, failure_reason: failureReason, attempt_number: attemptNumber, tier },
      amount,
      currency,
      payment_provider: paymentProvider,
      provider_event_id: context.stripeInvoiceId,
    });

    // Send time-boxed dunning email (non-fatal — never block the payment pipeline)
    void sendDunningEmail({
      userId,
      licenseNonce,
      tier: tier as string,
      amount,
      currency,
      failureReason,
      attemptNumber,
      settings,
      nextRetryAt,
    }).catch(err => logger.warn('[Dunning] Email send failed (non-fatal)', toError(err)));

    logger.info('[Dunning] Payment failure handled', { licenseNonce: licenseNonce.slice(0, 8), amount, attemptNumber, newState });
    return getDunningState(licenseNonce);
  } catch (error) {
    logger.error('[Dunning] Failed to handle payment failure', toError(error));
    throw error;
  }
}
