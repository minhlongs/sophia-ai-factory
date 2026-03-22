/**
 * Polar order event handlers — Cloudflare Workers compatible.
 * Handles: order.paid (credit MCU), order.refunded (deduct MCU)
 *
 * Idempotency is enforced via the D1 transactions table.
 */

import { D1Client } from '@/lib/db/d1-query-builder';
import { getTierByProductId } from '@/lib/billing/mcu-pricing';
import type { PolarWebhookEvent } from '@/lib/billing/polar-client';
import type { OrgBalance } from '@/lib/db/types';
import { WebhookKnownError } from '@/lib/billing/polar-webhook-error';

/** Validate amount and product_id present on order events. */
function validateOrderAttrs(amount: number, polarProductId: string | undefined, eventType: string) {
  if (!amount || amount <= 0) {
    throw new WebhookKnownError(`Invalid ${eventType} amount: ${amount}. Amount must be > 0`);
  }
  if (!polarProductId) {
    throw new WebhookKnownError(`Missing product_id in ${eventType} event`);
  }
}

export async function handleOrderPaid(db: D1Client, event: PolarWebhookEvent) {
  const attrs = event.data.attributes as Record<string, unknown>;
  const orderId = attrs.id as string;
  const customerId = attrs.customer_id as string;
  const amount = attrs.amount as number;
  const polarProductId = attrs.product_id as string | undefined;

  validateOrderAttrs(amount, polarProductId, 'order.paid');

  const tier = getTierByProductId(polarProductId!);
  if (!tier) throw new WebhookKnownError(`Unknown product ID: ${polarProductId}. Must be a valid tier.`);

  // IDEMPOTENCY: skip if already processed
  const { data: existing } = await db
    .from('transactions')
    .select('id')
    .eq('polar_order_id', orderId)
    .eq('type', 'credit')
    .single();

  if (existing) {
    console.log(`Order ${orderId} already processed - skipping (idempotent)`);
    return;
  }

  const { data: billingSettings } = await db
    .from('billing_settings')
    .select('org_id')
    .eq('polar_customer_id', customerId)
    .single();

  if (!billingSettings?.org_id) {
    throw new WebhookKnownError(`Organization not found for customer: ${customerId}`);
  }

  // Credit based on tier — not raw amount, to prevent manipulation
  const mcuToCredit = tier.mcuMonthly;

  const { error } = await db.rpc('credit_mcu_balance', {
    p_org_id: billingSettings.org_id,
    p_amount: mcuToCredit,
    p_subscription_id: orderId,
  });
  if (error) throw new Error(`Failed to credit MCU: ${error.message}`);

  await db.from('transactions').insert({
    org_id: billingSettings.org_id,
    type: 'credit',
    amount: mcuToCredit,
    polar_order_id: orderId,
    polar_customer_id: customerId,
    polar_product_id: polarProductId,
    tier_name: tier.name,
    created_at: new Date().toISOString(),
  });

  console.log(`Order paid: ${orderId} - Credited ${mcuToCredit} MCU to org ${billingSettings.org_id} (${tier.name})`);
}

export async function handleOrderRefunded(db: D1Client, event: PolarWebhookEvent) {
  const attrs = event.data.attributes as Record<string, unknown>;
  const orderId = attrs.id as string;
  const customerId = attrs.customer_id as string;
  const amount = attrs.amount as number;
  const polarProductId = attrs.product_id as string | undefined;

  validateOrderAttrs(amount, polarProductId, 'order.refunded');

  const tier = getTierByProductId(polarProductId!);
  if (!tier) throw new WebhookKnownError(`Unknown product ID: ${polarProductId}. Must be a valid tier.`);

  // IDEMPOTENCY: skip if already processed
  const { data: existing } = await db
    .from('transactions')
    .select('id')
    .eq('polar_order_id', orderId)
    .eq('type', 'debit')
    .single();

  if (existing) {
    console.log(`Refund ${orderId} already processed - skipping (idempotent)`);
    return;
  }

  const { data: billingSettings } = await db
    .from('billing_settings')
    .select('org_id')
    .eq('polar_customer_id', customerId)
    .single();

  if (!billingSettings?.org_id) {
    throw new WebhookKnownError(`Organization not found for customer: ${customerId}`);
  }

  const mcuToDeduct = tier.mcuMonthly;

  const { data: currentBalance } = await db
    .from<OrgBalance>('org_balances')
    .select('balance')
    .eq('org_id', billingSettings.org_id)
    .single();

  const newBalance = (currentBalance?.balance || 0) - mcuToDeduct;

  const { error } = await db
    .from('org_balances')
    .update({ balance: newBalance, last_updated: new Date().toISOString() })
    .eq('org_id', billingSettings.org_id);
  if (error) throw new Error(`Failed to deduct MCU: ${error.message}`);

  await db.from('transactions').insert({
    org_id: billingSettings.org_id,
    type: 'debit',
    amount: mcuToDeduct,
    polar_order_id: orderId,
    polar_customer_id: customerId,
    polar_product_id: polarProductId,
    tier_name: tier.name,
    created_at: new Date().toISOString(),
  });

  console.log(`Order refunded: ${orderId} - Deducted ${mcuToDeduct} MCU from org ${billingSettings.org_id} (${tier.name})`);
}
