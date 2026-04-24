/**
 * Dunning Actions — Payment Handlers
 *
 * Handles payment failure and success events.
 * Admin operations moved to dunning-admin-operations.ts
 *
 * @module billing/dunning/dunning-actions
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import type { Tier } from '@/types';
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

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface DunningAttemptRow {
  id: string;
  user_id: string;
  license_nonce: string;
  attempt_number: number;
  attempt_type: string;
  payment_provider: string;
  success: boolean;
  amount: number | null;
  currency: string;
  failure_reason: string | null;
  provider_response_id: string | null;
  dunning_state_before: DunningState | null;
  dunning_state_after: DunningState | null;
  next_retry_at: string | null;
  scheduled_retry_count: number;
  stripe_invoice_id: string | null;
  polar_order_id: string | null;
  created_at: string;
}

export interface PaymentFailureContext {
  userId: string;
  licenseNonce: string;
  tier: Tier;
  amount: number;
  currency: string;
  failureReason: string;
  paymentProvider: 'stripe' | 'polar';
  stripeInvoiceId?: string;
  polarOrderId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PaymentSuccessContext {
  userId: string;
  licenseNonce: string;
  tier: Tier;
  amount: number;
  currency: string;
  paymentProvider: 'stripe' | 'polar';
  providerChargeId: string;
  providerInvoiceId?: string;
}

// -------------------------------------------------------------------------
// Internal helper
// -------------------------------------------------------------------------

async function recordDunningAttempt(attempt: Omit<DunningAttemptRow, 'id' | 'created_at'>): Promise<string> {
  const db = createServerClient();
  const { data, error } = await db
    .from('dunning_attempts')
    .insert({
      user_id: attempt.user_id,
      license_nonce: attempt.license_nonce,
      attempt_number: attempt.attempt_number,
      attempt_type: attempt.attempt_type,
      payment_provider: attempt.payment_provider,
      success: attempt.success,
      amount: attempt.amount,
      currency: attempt.currency,
      failure_reason: attempt.failure_reason,
      provider_response_id: attempt.provider_response_id,
      dunning_state_before: attempt.dunning_state_before,
      dunning_state_after: attempt.dunning_state_after,
      next_retry_at: attempt.next_retry_at,
      scheduled_retry_count: attempt.scheduled_retry_count,
      stripe_invoice_id: attempt.stripe_invoice_id,
      polar_order_id: attempt.polar_order_id,
      ...(attempt.ip_address && { ip_address: attempt.ip_address }),
      ...(attempt.user_agent && { user_agent: attempt.user_agent }),
    } as any)
    .select('id')
    .single();

  if (error || !data) throw new Error(`Failed to record dunning attempt: ${error?.message || 'Unknown error'}`);
  return data.id;
}

// -------------------------------------------------------------------------
// Payment handlers
// -------------------------------------------------------------------------

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
      settings = newSettings as DunningSettingsRow;
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
      provider_response_id: context.stripeInvoiceId || context.polarOrderId || null,
      dunning_state_before: settings.dunning_state, dunning_state_after: newState,
      next_retry_at: nextRetryAt.toISOString(), scheduled_retry_count: attemptNumber,
      stripe_invoice_id: context.stripeInvoiceId || null, polar_order_id: context.polarOrderId || null,
      ip_address: context.ipAddress, user_agent: context.userAgent,
    });

    if (newState !== settings.dunning_state) await transitionDunningState(licenseNonce, userId, newState);

    await db.from('billing_events').insert({
      user_id: userId, license_nonce: licenseNonce, event_type: 'payment_failed',
      event_category: 'payment', event_data: { amount, currency, failure_reason: failureReason, attempt_number: attemptNumber, tier },
      amount, currency, payment_provider: paymentProvider,
      provider_event_id: context.stripeInvoiceId || context.polarOrderId,
    });

    logger.info('[Dunning] Payment failure handled', { licenseNonce: licenseNonce.slice(0, 8), amount, attemptNumber, newState });
    return getDunningState(licenseNonce);
  } catch (error) {
    logger.error('[Dunning] Failed to handle payment failure', toError(error));
    throw error;
  }
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
      stripe_invoice_id: context.providerInvoiceId || null, polar_order_id: null,
    } as Omit<DunningAttemptRow, 'id' | 'created_at'>);

    if (oldState !== 'current') await transitionDunningState(licenseNonce, userId, 'current');

    await db.from('billing_events').insert({
      user_id: userId, license_nonce: licenseNonce, event_type: 'payment_succeeded',
      event_category: 'payment', event_data: { amount, currency, charge_id: providerChargeId, tier },
      amount, currency, payment_provider: paymentProvider,
      provider_event_id: providerChargeId, provider_charge_id: providerChargeId,
      processed: true, processed_at: new Date().toISOString(),
    } as any);

    logger.info('[Dunning] Payment success handled', { licenseNonce: licenseNonce.slice(0, 8), amount, oldState });
    return getDunningState(licenseNonce);
  } catch (error) {
    logger.error('[Dunning] Failed to handle payment success', toError(error));
    throw error;
  }
}
