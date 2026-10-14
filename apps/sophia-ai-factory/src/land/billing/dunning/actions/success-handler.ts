/**
 * Payment Success Action Handler
 * Layer: LAND (Business Domain Workflows)
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  getDunningSettings,
  getDunningState,
  transitionDunningState,
  type DunningStateResult,
} from '../dunning-state-machine';
import {
  recordDunningAttempt,
  type DunningAttemptRow,
  type PaymentSuccessContext,
} from '../dunning-attempt-recorder';
import { invalidateDunningCache } from '../dunning-kv-cache';

/** Handle payment success - restore account to current */
export async function handlePaymentSuccess(context: PaymentSuccessContext): Promise<DunningStateResult> {
  const { userId, licenseNonce, tier, amount, currency, paymentProvider, providerChargeId } = context;

  try {
    const db = createServerClient();
    const currentSettings = await getDunningSettings(licenseNonce);
    const oldState = currentSettings?.dunning_state || 'current';

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
    } as Omit<DunningAttemptRow, 'id' | 'created_at'>);

    if (oldState !== 'current') {
      await transitionDunningState(licenseNonce, userId, 'current');
      await invalidateDunningCache(licenseNonce);
    }

    await db.from('billing_events').insert({
      user_id: userId,
      license_nonce: licenseNonce,
      event_type: 'payment_succeeded',
      event_category: 'payment',
      event_data: { amount, currency, charge_id: providerChargeId, tier },
      amount,
      currency,
      payment_provider: paymentProvider,
      provider_event_id: providerChargeId,
      provider_charge_id: providerChargeId,
      processed: true,
      processed_at: new Date().toISOString(),
    });

    logger.info('[Dunning] Payment success handled', { licenseNonce: licenseNonce.slice(0, 8), amount, oldState });
    return getDunningState(licenseNonce);
  } catch (error) {
    logger.error('[Dunning] Failed to handle payment success', toError(error));
    throw error;
  }
}
