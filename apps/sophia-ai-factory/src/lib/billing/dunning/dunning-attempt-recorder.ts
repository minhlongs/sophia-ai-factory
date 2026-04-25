/**
 * Dunning Attempt Recorder — DB types and attempt recording helper
 *
 * @module billing/dunning/dunning-attempt-recorder
 */

import { createServerClient } from '@/lib/db/client';
import type { DunningState } from './dunning-state-machine';
import type { Tier } from '@/types';

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
  ip_address?: string;
  user_agent?: string;
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

export async function recordDunningAttempt(attempt: Omit<DunningAttemptRow, 'id' | 'created_at'>): Promise<string> {
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
  return (data as unknown as { id: string }).id;
}
