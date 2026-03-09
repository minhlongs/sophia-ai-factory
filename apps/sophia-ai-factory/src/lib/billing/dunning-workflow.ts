/**
 * Dunning Workflow Service
 *
 * Manages payment failure workflow: current → past_due → delinquent → suspended
 *
 * Features:
 * - State machine for dunning lifecycle
 * - Grace period enforcement (configurable per tier)
 * - Payment retry scheduling (exponential backoff)
 * - State transition hooks for notifications
 * - Integration with Stripe/Polar webhooks
 *
 * Dunning States:
 * - current: Account in good standing
 * - past_due: Payment failed, grace period active
 * - delinquent: Multiple failed payments, suspension pending
 * - suspended: API access blocked, service restricted
 *
 * @module billing/dunning-workflow
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { Tier } from '@/types';

/**
 * Dunning state enum
 */
export type DunningState = 'current' | 'past_due' | 'delinquent' | 'suspended';

/**
 * Dunning event types for audit logging
 */
export type DunningEventType =
  | 'payment_failed'
  | 'payment_succeeded'
  | 'grace_period_started'
  | 'grace_period_ended'
  | 'suspension_started'
  | 'suspension_ended'
  | 'retry_scheduled'
  | 'retry_attempted'
  | 'state_changed';

/**
 * Dunning configuration by tier
 */
export interface DunningTierConfig {
  /** Days in past_due state before suspension */
  gracePeriodDays: number;
  /** Maximum retry attempts before suspension */
  maxRetryAttempts: number;
  /** Retry intervals in days (exponential backoff) */
  retryIntervals: number[];
  /** Allow overage during dunning (enterprise/master only) */
  allowOverage: boolean;
}

/**
 * Tier-specific dunning configurations
 */
export const DUNNING_TIER_CONFIGS: Record<Tier, DunningTierConfig> = {
  BASIC: {
    gracePeriodDays: 3,
    maxRetryAttempts: 3,
    retryIntervals: [1, 3, 7],
    allowOverage: false,
  },
  PREMIUM: {
    gracePeriodDays: 5,
    maxRetryAttempts: 4,
    retryIntervals: [1, 3, 7, 15],
    allowOverage: false,
  },
  ENTERPRISE: {
    gracePeriodDays: 7,
    maxRetryAttempts: 5,
    retryIntervals: [1, 2, 5, 10, 15],
    allowOverage: true,
  },
  MASTER: {
    gracePeriodDays: 14,
    maxRetryAttempts: 6,
    retryIntervals: [1, 2, 3, 7, 14, 21],
    allowOverage: true,
  },
};

/**
 * Dunning settings from database
 */
export interface DunningSettingsRow {
  id: string;
  user_id: string;
  license_nonce: string;
  polar_customer_id: string | null;
  stripe_customer_id: string | null;
  grace_period_days: number;
  max_retry_attempts: number;
  retry_schedule: string[];
  send_email_notifications: boolean;
  email_language: string;
  dunning_state: DunningState;
  dunning_state_changed_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Dunning attempt record
 */
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

/**
 * Result of dunning state check
 */
export interface DunningStateResult {
  /** Current dunning state */
  state: DunningState;
  /** Whether API access should be allowed */
  allowed: boolean;
  /** Grace period end timestamp (if in past_due) */
  gracePeriodEndsAt: Date | null;
  /** Next retry timestamp */
  nextRetryAt: Date | null;
  /** Failed payment count in last 30 days */
  failedPaymentCount: number;
  /** Reason for block (if suspended) */
  blockReason?: string;
}

/**
 * Payment failure context
 */
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

/**
 * Payment success context
 */
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

/**
 * Get dunning settings for license
 */
export async function getDunningSettings(
  licenseNonce: string
): Promise<DunningSettingsRow | null> {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from('dunning_settings')
      .select('*')
      .eq('license_nonce', licenseNonce)
      .single();

    if (error || !data) {
      logger.debug('[Dunning] No settings found for license', { licenseNonce: licenseNonce.slice(0, 8) });
      return null;
    }

    return data as DunningSettingsRow;
  } catch (error) {
    logger.error('[Dunning] Failed to get settings', error as Error);
    return null;
  }
}

/**
 * Get current dunning state for license
 */
export async function getDunningState(
  licenseNonce: string
): Promise<DunningStateResult> {
  const settings = await getDunningSettings(licenseNonce);

  // No settings = current state (no dunning history)
  if (!settings) {
    return {
      state: 'current',
      allowed: true,
      gracePeriodEndsAt: null,
      nextRetryAt: null,
      failedPaymentCount: 0,
    };
  }

  const supabase = createAdminClient();

  // Get failed payment count and next retry
  const { data: failedAttempts } = await supabase
    .from('dunning_attempts')
    .select('next_retry_at')
    .eq('license_nonce', licenseNonce)
    .eq('success', false)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  const failedPaymentCount = failedAttempts?.length || 0;
  const nextRetryAt = failedAttempts?.[0]?.next_retry_at
    ? new Date(failedAttempts[0].next_retry_at)
    : null;

  // Calculate grace period end
  let gracePeriodEndsAt: Date | null = null;
  if (settings.dunning_state === 'past_due' && settings.dunning_state_changed_at) {
    const stateChangedAt = new Date(settings.dunning_state_changed_at);
    gracePeriodEndsAt = new Date(
      stateChangedAt.getTime() + settings.grace_period_days * 24 * 60 * 60 * 1000
    );
  }

  // Determine if access is allowed
  let allowed = true;
  let blockReason: string | undefined;

  if (settings.dunning_state === 'suspended') {
    allowed = false;
    blockReason = 'Account suspended due to non-payment';
  } else if (settings.dunning_state === 'delinquent') {
    // Delinquent accounts are blocked but not yet suspended
    allowed = false;
    blockReason = 'Account delinquent - payment required to restore access';
  } else if (
    settings.dunning_state === 'past_due' &&
    gracePeriodEndsAt &&
    gracePeriodEndsAt < new Date()
  ) {
    // Grace period expired - should transition to suspended
    allowed = false;
    blockReason = 'Grace period expired - account suspended';
  }

  return {
    state: settings.dunning_state,
    allowed,
    gracePeriodEndsAt,
    nextRetryAt,
    failedPaymentCount,
    blockReason,
  };
}

/**
 * Transition dunning state
 */
async function transitionDunningState(
  licenseNonce: string,
  userId: string,
  newState: DunningState
): Promise<void> {
  const supabase = createAdminClient();

  // Get current state
  const currentSettings = await getDunningSettings(licenseNonce);
  const oldState = currentSettings?.dunning_state || 'current';

  // Skip if no change
  if (oldState === newState) {
    logger.debug('[Dunning] State unchanged, skipping transition', {
      licenseNonce: licenseNonce.slice(0, 8),
      state: newState,
    });
    return;
  }

  // Update settings
  await supabase.rpc('update_dunning_state', {
    p_license_nonce: licenseNonce,
    p_new_state: newState,
    p_user_id: userId,
  });

  logger.info('[Dunning] State transitioned', {
    licenseNonce: licenseNonce.slice(0, 8),
    from: oldState,
    to: newState,
  });
}

/**
 * Record dunning attempt
 */
async function recordDunningAttempt(
  attempt: Omit<DunningAttemptRow, 'id' | 'created_at'>
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
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

  if (error || !data) {
    throw new Error(`Failed to record dunning attempt: ${error?.message || 'Unknown error'}`);
  }

  return data.id;
}

/**
 * Schedule next retry based on exponential backoff
 */
function calculateNextRetry(attemptNumber: number, config: DunningTierConfig): Date {
  const intervalIndex = Math.min(attemptNumber - 1, config.retryIntervals.length - 1);
  const daysUntilRetry = config.retryIntervals[intervalIndex] || 7;

  const nextRetry = new Date();
  nextRetry.setDate(nextRetry.getDate() + daysUntilRetry);
  return nextRetry;
}

/**
 * Handle payment failure - core dunning logic
 *
 * Flow:
 * 1. Get current dunning settings
 * 2. Determine new state based on attempt count
 * 3. Record failed attempt
 * 4. Schedule next retry
 * 5. Transition state if needed
 * 6. Log billing event
 *
 * @param context - Payment failure context
 * @returns Updated dunning state
 */
export async function handlePaymentFailure(
  context: PaymentFailureContext
): Promise<DunningStateResult> {
  const { userId, licenseNonce, tier, amount, currency, failureReason, paymentProvider } = context;

  try {
    // Get tier config
    const tierConfig = DUNNING_TIER_CONFIGS[tier];

    // Get current settings
    let settings = await getDunningSettings(licenseNonce);

    // Initialize settings if not exists
    if (!settings) {
      const supabase = createAdminClient();
      const { data: newSettings, error } = await supabase
        .from('dunning_settings')
        .insert({
          user_id: userId,
          license_nonce: licenseNonce,
          polar_customer_id: context.polarOrderId ? null : undefined,
          stripe_customer_id: context.stripeInvoiceId ? null : undefined,
          grace_period_days: tierConfig.gracePeriodDays,
          max_retry_attempts: tierConfig.maxRetryAttempts,
          retry_schedule: tierConfig.retryIntervals.map(d => `${d} days`),
          dunning_state: 'current',
        })
        .select()
        .single();

      if (error || !newSettings) {
        throw new Error(`Failed to initialize dunning settings: ${error?.message}`);
      }
      settings = newSettings as DunningSettingsRow;
    }

    // Count recent failed attempts
    const supabase = createAdminClient();
    const { count: recentFailures } = await supabase
      .from('dunning_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('license_nonce', licenseNonce)
      .eq('success', false)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const attemptNumber = (recentFailures || 0) + 1;

    // Determine new state
    let newState: DunningState = settings.dunning_state;
    if (settings.dunning_state === 'current') {
      newState = 'past_due';
    } else if (
      settings.dunning_state === 'past_due' &&
      attemptNumber >= tierConfig.maxRetryAttempts
    ) {
      newState = 'suspended';
    } else if (
      settings.dunning_state === 'past_due' &&
      attemptNumber >= Math.ceil(tierConfig.maxRetryAttempts / 2)
    ) {
      newState = 'delinquent';
    }

    // Calculate next retry date
    const nextRetryAt = calculateNextRetry(attemptNumber, tierConfig);

    // Record failed attempt
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
      provider_response_id: context.stripeInvoiceId || context.polarOrderId || null,
      dunning_state_before: settings.dunning_state,
      dunning_state_after: newState,
      next_retry_at: nextRetryAt.toISOString(),
      scheduled_retry_count: attemptNumber,
      stripe_invoice_id: context.stripeInvoiceId || null,
      polar_order_id: context.polarOrderId || null,
      ip_address: context.ipAddress,
      user_agent: context.userAgent,
    });

    // Transition state if changed
    if (newState !== settings.dunning_state) {
      await transitionDunningState(licenseNonce, userId, newState);
    }

    // Log billing event
    await supabase.from('billing_events').insert({
      user_id: userId,
      license_nonce: licenseNonce,
      event_type: 'payment_failed',
      event_category: 'payment',
      event_data: {
        amount,
        currency,
        failure_reason: failureReason,
        attempt_number: attemptNumber,
        tier,
      },
      amount,
      currency,
      payment_provider: paymentProvider,
      provider_event_id: context.stripeInvoiceId || context.polarOrderId,
    });

    logger.info('[Dunning] Payment failure handled', {
      licenseNonce: licenseNonce.slice(0, 8),
      amount,
      attemptNumber,
      newState,
      nextRetryAt,
    });

    // Return updated state
    return getDunningState(licenseNonce);
  } catch (error) {
    logger.error('[Dunning] Failed to handle payment failure', error as Error);
    throw error;
  }
}

/**
 * Handle payment success - restore account
 *
 * Flow:
 * 1. Record successful payment
 * 2. Transition state to 'current'
 * 3. Clear any pending retries
 * 4. Log billing event
 *
 * @param context - Payment success context
 */
export async function handlePaymentSuccess(
  context: PaymentSuccessContext
): Promise<DunningStateResult> {
  const { userId, licenseNonce, tier, amount, currency, paymentProvider, providerChargeId } = context;

  try {
    const supabase = createAdminClient();

    // Get current state
    const currentSettings = await getDunningSettings(licenseNonce);
    const oldState = currentSettings?.dunning_state || 'current';

    // Record successful attempt
    await recordDunningAttempt({
      user_id: userId,
      license_nonce: licenseNonce,
      attempt_number: 1,
      attempt_type: 'payment_succeeded',
      payment_provider: paymentProvider,
      success: true,
      amount,
      currency,
      failure_reason: null,
      provider_response_id: providerChargeId,
      dunning_state_before: oldState,
      dunning_state_after: 'current',
      next_retry_at: null,
      scheduled_retry_count: 0,
      stripe_invoice_id: context.providerInvoiceId || null,
      polar_order_id: null,
    } as Omit<DunningAttemptRow, 'id' | 'created_at'>);

    // Transition to current state
    if (oldState !== 'current') {
      await transitionDunningState(licenseNonce, userId, 'current');
    }

    // Log billing event
    await supabase.from('billing_events').insert({
      user_id: userId,
      license_nonce: licenseNonce,
      event_type: 'payment_succeeded',
      event_category: 'payment',
      event_data: {
        amount,
        currency,
        charge_id: providerChargeId,
        tier,
      },
      amount,
      currency,
      payment_provider: paymentProvider,
      provider_event_id: providerChargeId,
      provider_charge_id: providerChargeId,
      processed: true,
      processed_at: new Date().toISOString(),
    } as any);

    logger.info('[Dunning] Payment success handled', {
      licenseNonce: licenseNonce.slice(0, 8),
      amount,
      oldState,
    });

    // Return updated state
    return getDunningState(licenseNonce);
  } catch (error) {
    logger.error('[Dunning] Failed to handle payment success', error as Error);
    throw error;
  }
}

/**
 * Check if license can access API (dunning-aware)
 *
 * Quick check without full state lookup
 */
export async function canAccessApi(licenseNonce: string): Promise<{
  allowed: boolean;
  state: DunningState;
  reason?: string;
}> {
  const stateResult = await getDunningState(licenseNonce);

  return {
    allowed: stateResult.allowed,
    state: stateResult.state,
    reason: stateResult.blockReason,
  };
}

/**
 * Get dunning history for license
 */
export async function getDunningHistory(
  licenseNonce: string,
  limit: number = 20
): Promise<DunningAttemptRow[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('dunning_attempts')
    .select('*')
    .eq('license_nonce', licenseNonce)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('[Dunning] Failed to fetch history', error as Error);
    return [];
  }

  return data as DunningAttemptRow[];
}

/**
 * Initialize dunning settings for new license
 */
export async function initializeDunningSettings(
  userId: string,
  licenseNonce: string,
  tier: Tier,
  polarCustomerId?: string,
  stripeCustomerId?: string
): Promise<DunningSettingsRow> {
  const supabase = createAdminClient();
  const tierConfig = DUNNING_TIER_CONFIGS[tier];

  const { data, error } = await supabase
    .from('dunning_settings')
    .insert({
      user_id: userId,
      license_nonce: licenseNonce,
      polar_customer_id: polarCustomerId || null,
      stripe_customer_id: stripeCustomerId || null,
      grace_period_days: tierConfig.gracePeriodDays,
      max_retry_attempts: tierConfig.maxRetryAttempts,
      retry_schedule: tierConfig.retryIntervals.map(d => `${d} days`),
      send_email_notifications: true,
      email_language: 'en',
      dunning_state: 'current',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to initialize dunning settings: ${error?.message}`);
  }

  logger.info('[Dunning] Settings initialized', {
    licenseNonce: licenseNonce.slice(0, 8),
    tier,
    gracePeriodDays: tierConfig.gracePeriodDays,
  });

  return data as DunningSettingsRow;
}

/**
 * Manually suspend license (admin action)
 */
export async function suspendLicense(
  licenseNonce: string,
  userId: string,
  reason: string
): Promise<DunningStateResult> {
  await transitionDunningState(licenseNonce, userId, 'suspended');

  // Log suspension event
  const supabase = createAdminClient();
  await supabase.from('billing_events').insert({
    user_id: userId,
    license_nonce: licenseNonce,
    event_type: 'suspension_started',
    event_category: 'dunning',
    event_data: { reason, manual: true },
  });

  logger.warn('[Dunning] License manually suspended', {
    licenseNonce: licenseNonce.slice(0, 8),
    reason,
  });

  return getDunningState(licenseNonce);
}

/**
 * Manually restore license (admin action)
 */
export async function restoreLicense(
  licenseNonce: string,
  userId: string,
  reason: string
): Promise<DunningStateResult> {
  await transitionDunningState(licenseNonce, userId, 'current');

  // Log restoration event
  const supabase = createAdminClient();
  await supabase.from('billing_events').insert({
    user_id: userId,
    license_nonce: licenseNonce,
    event_type: 'suspension_ended',
    event_category: 'dunning',
    event_data: { reason, manual: true },
  });

  logger.info('[Dunning] License manually restored', {
    licenseNonce: licenseNonce.slice(0, 8),
    reason,
  });

  return getDunningState(licenseNonce);
}

/**
 * Export for webhook handlers
 */
export const dunningWorkflow = {
  getDunningState,
  handlePaymentFailure,
  handlePaymentSuccess,
  canAccessApi,
  getDunningHistory,
  initializeDunningSettings,
  suspendLicense,
  restoreLicense,
};
