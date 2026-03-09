/**
 * Stripe Webhook Handler for Cloudflare Worker
 *
 * Receives and validates Stripe webhook events at the edge,
 * updates dunning state in RaaS Gateway KV, and triggers
 * notifications to AgencyOS.
 *
 * Events handled:
 * - invoice.payment_failed → Set dunning state to past_due
 * - invoice.payment_succeeded → Restore dunning state to current
 * - customer.subscription.updated → Sync subscription status
 *
 * @module worker/stripe-webhook
 */

import { z } from 'zod';

/**
 * Environment bindings for Stripe webhook
 */
export interface StripeWebhookEnv {
  KV_KV: KVNamespace;
  STRIPE_WEBHOOK_SECRET: string;
  AGENCYOS_NOTIFICATION_URL: string;
  AGENCYOS_WEBHOOK_SECRET: string;
}

/**
 * Dunning state enum
 */
export type DunningState = 'current' | 'past_due' | 'delinquent' | 'suspended';

/**
 * Dunning state object stored in KV
 */
export interface DunningStateObject {
  state: DunningState;
  licenseNonce: string;
  userId: string;
  stripeCustomerId: string;
  failedPaymentCount: number;
  lastPaymentFailedAt: number | null;
  gracePeriodEndsAt: number | null;
  nextRetryAt: number | null;
  suspendedAt: number | null;
  updatedAt: number;
}

/**
 * Stripe event schema
 */
const stripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.object({
      id: z.string(),
      customer: z.union([z.string(), z.object({ id: z.string() })]).optional(),
      amount_due: z.number().optional(),
      currency: z.string().optional(),
      charge: z.union([
        z.string(),
        z.object({
          id: z.string(),
          failure_message: z.string().optional(),
        }),
      ]).optional(),
      status: z.string().optional(),
      subscription: z.string().optional(),
    }),
  }),
});

type StripeEvent = z.infer<typeof stripeEventSchema>;

/**
 * Verify Stripe webhook signature
 *
 * Uses timing-safe comparison to prevent timing attacks
 */
export async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuf = hexToArrayBuffer(signature.replace(/^t=\d+,(v\d+)=/, '$1=').split(',')[1] || '');

    // Extract timestamp and signature from Stripe signature format
    // Format: t=timestamp,v1=signature,v0=legacy
    const parts = signature.split(',');
    const timestamp = parseInt(parts.find(p => p.startsWith('t='))?.substring(2) || '0', 10);
    const signedPayload = `${timestamp}.${body}`;

    const expectedSig = await crypto.subtle.sign(
      'HMAC',
      keyData,
      encoder.encode(signedPayload)
    );

    // Timing-safe comparison
    return arrayBufferEqual(signatureBuf, expectedSig);
  } catch {
    return false;
  }
}

/**
 * Convert hex string to ArrayBuffer
 */
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Timing-safe ArrayBuffer comparison
 */
function arrayBufferEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const ta = new Uint8Array(a);
  const tb = new Uint8Array(b);
  let result = 0;
  for (let i = 0; i < ta.length; i++) {
    result |= ta[i] ^ tb[i];
  }
  return result === 0;
}

/**
 * Get dunning state from KV
 */
export async function getDunningState(
  licenseNonce: string,
  kv: KVNamespace
): Promise<DunningStateObject | null> {
  const key = `dunning:${licenseNonce}`;
  const data = await kv.get(key, { type: 'json' });
  return data as DunningStateObject | null;
}

/**
 * Update dunning state in KV
 */
export async function updateDunningState(
  state: DunningStateObject,
  kv: KVNamespace
): Promise<void> {
  const key = `dunning:${state.licenseNonce}`;
  await kv.put(key, JSON.stringify(state), {
    metadata: {
      state: state.state,
      updatedAt: state.updatedAt,
    },
  });
}

/**
 * Handle invoice.payment_failed event
 *
 * Flow:
 * 1. Extract customer ID and license nonce from event
 * 2. Get current dunning state from KV
 * 3. Update state to past_due
 * 4. Calculate grace period end
 * 5. Trigger notification to AgencyOS
 */
export async function handlePaymentFailed(
  event: StripeEvent,
  env: StripeWebhookEnv
): Promise<{ success: boolean; error?: string }> {
  const stripeEvent = event.data.object;

  // Get customer ID
  const customerId = typeof stripeEvent.customer === 'string'
    ? stripeEvent.customer
    : stripeEvent.customer?.id;

  if (!customerId) {
    return { success: false, error: 'No customer ID in event' };
  }

  // Lookup license nonce by Stripe customer ID
  const licenseLookup = await env.KV_KV.get(`stripe_customer:${customerId}`, { type: 'json' }) as {
    licenseNonce: string;
    userId: string;
  } | null;

  if (!licenseLookup) {
    return { success: false, error: 'License not found for customer' };
  }

  const { licenseNonce, userId } = licenseLookup;

  // Get current dunning state
  const currentState = await getDunningState(licenseNonce, env.KV_KV);

  // Calculate new state
  const failedCount = currentState ? currentState.failedPaymentCount + 1 : 1;
  const now = Date.now();

  // Grace period: 3 days for BASIC, 7 days for ENTERPRISE
  const gracePeriodDays = 3; // Could be tier-specific
  const gracePeriodEndsAt = now + (gracePeriodDays * 24 * 60 * 60 * 1000);

  const newState: DunningStateObject = {
    state: 'past_due',
    licenseNonce,
    userId,
    stripeCustomerId: customerId,
    failedPaymentCount: failedCount,
    lastPaymentFailedAt: now,
    gracePeriodEndsAt,
    nextRetryAt: now + (24 * 60 * 60 * 1000), // Retry in 24 hours
    suspendedAt: null,
    updatedAt: now,
  };

  // Update KV
  await updateDunningState(newState, env.KV_KV);

  // Trigger notification to AgencyOS
  await triggerNotification({
    type: 'payment_failed',
    userId,
    licenseNonce,
    data: {
      amount: stripeEvent.amount_due,
      currency: stripeEvent.currency,
      failedCount,
      gracePeriodEndsAt,
    },
  }, env);

  return { success: true };
}

/**
 * Handle invoice.payment_succeeded event
 *
 * Flow:
 * 1. Extract customer ID and license nonce
 * 2. Restore dunning state to current
 * 3. Clear failed payment count
 * 4. Trigger success notification
 */
export async function handlePaymentSucceeded(
  event: StripeEvent,
  env: StripeWebhookEnv
): Promise<{ success: boolean; error?: string }> {
  const stripeEvent = event.data.object;

  const customerId = typeof stripeEvent.customer === 'string'
    ? stripeEvent.customer
    : stripeEvent.customer?.id;

  if (!customerId) {
    return { success: false, error: 'No customer ID in event' };
  }

  // Lookup license nonce
  const licenseLookup = await env.KV_KV.get(`stripe_customer:${customerId}`, { type: 'json' }) as {
    licenseNonce: string;
    userId: string;
  } | null;

  if (!licenseLookup) {
    return { success: false, error: 'License not found for customer' };
  }

  const { licenseNonce, userId } = licenseLookup;

  // Restore to current state
  const now = Date.now();
  const newState: DunningStateObject = {
    state: 'current',
    licenseNonce,
    userId,
    stripeCustomerId: customerId,
    failedPaymentCount: 0,
    lastPaymentFailedAt: null,
    gracePeriodEndsAt: null,
    nextRetryAt: null,
    suspendedAt: null,
    updatedAt: now,
  };

  await updateDunningState(newState, env.KV_KV);

  // Trigger success notification
  await triggerNotification({
    type: 'payment_succeeded',
    userId,
    licenseNonce,
    data: {
      amount: stripeEvent.amount_due,
      currency: stripeEvent.currency,
    },
  }, env);

  return { success: true };
}

/**
 * Handle customer.subscription.updated event
 *
 * Flow:
 * 1. Extract subscription status
 * 2. Sync to KV subscription state
 * 3. Update dunning state if status is past_due
 */
export async function handleSubscriptionUpdated(
  event: StripeEvent,
  env: StripeWebhookEnv
): Promise<{ success: boolean; error?: string }> {
  const stripeEvent = event.data.object;
  const status = stripeEvent.status;

  const customerId = typeof stripeEvent.customer === 'string'
    ? stripeEvent.customer
    : stripeEvent.customer?.id;

  if (!customerId) {
    return { success: false, error: 'No customer ID in event' };
  }

  // Lookup license nonce
  const licenseLookup = await env.KV_KV.get(`stripe_customer:${customerId}`, { type: 'json' }) as {
    licenseNonce: string;
    userId: string;
  } | null;

  if (!licenseLookup) {
    return { success: false, error: 'License not found for customer' };
  }

  const { licenseNonce, userId } = licenseLookup;

  // Get current dunning state
  const currentState = await getDunningState(licenseNonce, env.KV_KV);

  // Update state based on subscription status
  let dunningState: DunningState = 'current';
  if (status === 'past_due') {
    dunningState = 'past_due';
  } else if (status === 'unpaid' || status === 'incomplete') {
    dunningState = 'delinquent';
  } else if (status === 'canceled') {
    dunningState = 'suspended';
  }

  const now = Date.now();
  const newState: DunningStateObject = {
    state: dunningState,
    licenseNonce,
    userId,
    stripeCustomerId: customerId,
    failedPaymentCount: currentState?.failedPaymentCount || 0,
    lastPaymentFailedAt: dunningState === 'past_due' ? now : currentState?.lastPaymentFailedAt || null,
    gracePeriodEndsAt: null,
    nextRetryAt: null,
    suspendedAt: dunningState === 'suspended' ? now : null,
    updatedAt: now,
  };

  await updateDunningState(newState, env.KV_KV);

  // Sync to AgencyOS dashboard
  await syncToDashboard({
    licenseNonce,
    userId,
    stripeCustomerId: customerId,
    subscriptionStatus: status || 'unknown',
    dunningState: dunningState,
  }, env);

  return { success: true };
}

/**
 * Notification payload
 */
interface NotificationPayload {
  type: 'payment_failed' | 'payment_succeeded' | 'subscription_updated';
  userId: string;
  licenseNonce: string;
  data: Record<string, unknown>;
}

/**
 * Trigger notification to AgencyOS
 */
async function triggerNotification(
  payload: NotificationPayload,
  env: StripeWebhookEnv
): Promise<void> {
  try {
    const timestamp = Date.now();
    const body = JSON.stringify(payload);

    // Create HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.AGENCYOS_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
    const signatureHex = arrayBufferToHex(signature);

    await fetch(env.AGENCYOS_NOTIFICATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Signature': signatureHex,
      },
      body,
    });
  } catch (error) {
    console.error('[Worker] Failed to trigger notification', error);
    // Don't throw - notification failure shouldn't block webhook processing
  }
}

/**
 * Dashboard sync payload
 */
interface DashboardSyncPayload {
  licenseNonce: string;
  userId: string;
  stripeCustomerId: string;
  subscriptionStatus: string;
  dunningState: DunningState;
}

/**
 * Sync subscription status to AgencyOS dashboard
 */
async function syncToDashboard(
  payload: DashboardSyncPayload,
  env: StripeWebhookEnv
): Promise<void> {
  try {
    const timestamp = Date.now();
    const body = JSON.stringify(payload);

    // Create HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.AGENCYOS_WEBHOOK_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
    const signatureHex = arrayBufferToHex(signature);

    await fetch(`${env.AGENCYOS_NOTIFICATION_URL}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Signature': signatureHex,
      },
      body,
    });
  } catch (error) {
    console.error('[Worker] Failed to sync to dashboard', error);
  }
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
