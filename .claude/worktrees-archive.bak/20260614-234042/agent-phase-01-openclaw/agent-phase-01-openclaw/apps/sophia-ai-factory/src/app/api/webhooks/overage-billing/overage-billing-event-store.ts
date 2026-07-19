/**
 * Overage billing event storage and idempotency helpers
 *
 * Handles storing usage events and overage records to Supabase,
 * with idempotency key checks to prevent duplicate processing.
 */

import { createServerClient } from '@/seed/db/client';
import { z } from 'zod';

// Webhook event schema (shared between modules)
export const overageEventSchema = z.object({
  licenseNonce: z.string(),
  userId: z.string(),
  tier: z.string(),
  usageCount: z.number(),
  overageCount: z.number(),
  overageFee: z.number(),
  timestamp: z.number(),
  idempotencyKey: z.string(),
  service: z.string().optional(),
  billingPeriod: z.string().optional()
});

export type OverageEvent = z.infer<typeof overageEventSchema>;

// Header validation schema
export const headerSchema = z.object({
  'webhook-id': z.string().min(1),
  'webhook-timestamp': z.string().min(1),
  'webhook-signature': z.string().min(1).optional(),
  'Polar-Signature': z.string().min(1).optional(),
  'X-Cloudflare-Signature': z.string().min(1).optional()
}).refine(
  data => data['webhook-signature'] || data['Polar-Signature'] || data['X-Cloudflare-Signature'],
  { message: 'At least one signature header required' }
);

/**
 * Check if event was already processed (idempotency)
 */
export async function checkIdempotency(
  idempotencyKey: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<boolean> {
  const { data, error } = await supabase
    .from('usage_events')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .single();

  return !error && data !== null;
}

/**
 * Store usage event in Supabase
 */
export async function storeUsageEvent(
  event: OverageEvent,
  supabase: ReturnType<typeof createServerClient>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('usage_events').insert({
    license_nonce: event.licenseNonce,
    user_id: event.userId,
    tier: event.tier.toUpperCase(),
    usage_count: event.usageCount,
    overage_count: event.overageCount,
    overage_fee: event.overageFee,
    event_timestamp: new Date(event.timestamp).toISOString(),
    idempotency_key: event.idempotencyKey,
    service: event.service || 'default',
    billing_period: event.billingPeriod
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Log overage event for billing reconciliation
 * Non-critical: errors are swallowed to not fail the webhook
 */
export async function logOverageEvent(
  event: OverageEvent,
  supabase: ReturnType<typeof createServerClient>
): Promise<void> {
  if (event.overageFee <= 0) return;

  await supabase
    .from('overage_events')
    .insert({
      user_id: event.userId,
      license_nonce: event.licenseNonce,
      overage_count: event.overageCount,
      overage_fee: event.overageFee,
      billing_period: event.billingPeriod,
      processed: false
    });
  // Errors swallowed intentionally — do not fail the webhook on overage log failure
}
