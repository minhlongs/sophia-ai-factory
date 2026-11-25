/**
 * Overage billing event storage and atomic idempotency helpers
 *
 * Handles storing usage events and overage records to D1,
 * with atomic `payment_events` idempotency locking so duplicate webhook IDs
 * cannot double-record `usage_events` or `overage_events`.
 */

import { createServerClient, getD1 } from '@/seed/db/client';
import { z } from 'zod';

export const overageEventSchema = z.object({
  licenseNonce: z.string(),
  userId: z.string(),
  tier: z.string(),
  usageCount: z.number(),
  overageCount: z.number(),
  overageFee: z.number(),
  timestamp: z.number(),
  idempotencyKey: z.string().min(1),
  service: z.string().optional(),
  billingPeriod: z.string().optional(),
});

export type OverageEvent = z.infer<typeof overageEventSchema>;

export const headerSchema = z
  .object({
    'webhook-id': z.string().min(1),
    'webhook-timestamp': z.string().min(1),
    'webhook-signature': z.string().min(1).optional(),
    'X-Cloudflare-Signature': z.string().min(1).optional(),
  })
  .refine(
    (data) => Boolean(data['webhook-signature'] || data['X-Cloudflare-Signature']),
    { message: 'At least one supported signature header required' },
  );

export type IdempotencyClaimState = 'claimed' | 'duplicate_processed' | 'in_progress';

export async function claimOverageWebhookIdempotency(
  webhookId: string,
  idempotencyKey: string,
  rawBody: string,
  db: ReturnType<typeof createServerClient>,
): Promise<IdempotencyClaimState> {
  const d1 = await getD1().catch(() => null);
  if (d1) {
    const eventKey = `overage_billing_${idempotencyKey}`;
    const webhookHeaderKey = `overage_webhook_id_${webhookId}`;

    const lockRes = await d1
      .prepare(
        `INSERT INTO payment_events (event_id, event_type, payload, processed)
         VALUES (?1, 'overage.billing', ?2, 0)
         ON CONFLICT(event_id) DO NOTHING`,
      )
      .bind(eventKey, rawBody)
      .run();

    if ((lockRes.meta?.changes ?? 0) === 0) {
      const existing = await d1
        .prepare('SELECT processed FROM payment_events WHERE event_id = ?1 LIMIT 1')
        .bind(eventKey)
        .first<{ processed: number }>();
      return existing?.processed === 1 ? 'duplicate_processed' : 'in_progress';
    }

    const headerLockRes = await d1
      .prepare(
        `INSERT INTO payment_events (event_id, event_type, payload, processed)
         VALUES (?1, 'overage.webhook_id', ?2, 0)
         ON CONFLICT(event_id) DO NOTHING`,
      )
      .bind(webhookHeaderKey, eventKey)
      .run();

    if ((headerLockRes.meta?.changes ?? 0) === 0) {
      await d1.prepare('DELETE FROM payment_events WHERE event_id = ?1 AND processed = 0').bind(eventKey).run();
      const existingHeader = await d1
        .prepare('SELECT processed FROM payment_events WHERE event_id = ?1 LIMIT 1')
        .bind(webhookHeaderKey)
        .first<{ processed: number }>();
      return existingHeader?.processed === 1 ? 'duplicate_processed' : 'in_progress';
    }

    return 'claimed';
  }

  const alreadyExists = await checkIdempotency(idempotencyKey, db);
  return alreadyExists ? 'duplicate_processed' : 'claimed';
}

export async function finalizeOverageWebhookIdempotency(
  webhookId: string,
  idempotencyKey: string,
  succeeded: boolean,
): Promise<void> {
  const d1 = await getD1().catch(() => null);
  if (!d1) return;

  const eventKey = `overage_billing_${idempotencyKey}`;
  const webhookHeaderKey = `overage_webhook_id_${webhookId}`;

  if (succeeded) {
    await d1
      .batch([
        d1.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(eventKey),
        d1.prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1').bind(webhookHeaderKey),
      ])
      .catch(() => undefined);
    return;
  }

  await d1
    .batch([
      d1.prepare('DELETE FROM payment_events WHERE event_id = ?1 AND processed = 0').bind(eventKey),
      d1.prepare('DELETE FROM payment_events WHERE event_id = ?1 AND processed = 0').bind(webhookHeaderKey),
    ])
    .catch(() => undefined);
}

/**
 * Check if event was already processed (idempotency fallback).
 */
export async function checkIdempotency(
  idempotencyKey: string,
  supabase: ReturnType<typeof createServerClient>,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('usage_events')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .single();

  return !error && data !== null;
}

/**
 * Store usage event.
 */
export async function storeUsageEvent(
  event: OverageEvent,
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
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
    billing_period: event.billingPeriod,
  });

  if (error) {
    if (/UNIQUE constraint failed|duplicate key/i.test(error.message)) {
      return { success: true, duplicate: true };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Log overage event for billing reconciliation.
 */
export async function logOverageEvent(
  event: OverageEvent,
  supabase: ReturnType<typeof createServerClient>,
): Promise<void> {
  if (event.overageFee <= 0) return;

  await supabase.from('overage_events').insert({
    user_id: event.userId,
    license_nonce: event.licenseNonce,
    overage_count: event.overageCount,
    overage_fee: event.overageFee,
    billing_period: event.billingPeriod,
    processed: false,
  });
}
