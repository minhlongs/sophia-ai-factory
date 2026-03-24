/**
 * Polar subscription event handlers — Cloudflare Workers compatible.
 * Handles: subscription.created, subscription.updated, subscription.deleted
 */

import { D1Client } from '@/lib/db/d1-query-builder';
import { getTierByProductId } from '@/lib/billing/mcu-pricing';
import type { PolarWebhookEvent } from '@/lib/billing/polar-client';
import { WebhookKnownError } from '@/lib/billing/polar-webhook-error';

/**
 * If the org came via a referral code, credit the referrer via /api/referral/earn.
 * Non-fatal — errors are logged but do not fail the webhook.
 */
async function maybeProcessReferralCommission(
  db: D1Client,
  customerId: string,
  subscriptionId: string,
  subscriptionAmountCents: number
) {
  try {
    const { data: billing } = await db
      .from('billing_settings')
      .select('org_id, metadata')
      .eq('polar_customer_id', customerId)
      .single();

    if (!billing?.org_id) return;

    const referralCode = (billing.metadata as Record<string, string> | null)?.referral_code;
    if (!referralCode) return;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/referral/earn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({
        referral_code: referralCode,
        referred_org_id: billing.org_id,
        subscription_amount_cents: subscriptionAmountCents,
        polar_subscription_id: subscriptionId,
      }),
    });

    if (!res.ok) {
      console.error('Referral earn call failed:', await res.json().catch(() => ({})));
    }
  } catch (e) {
    console.error('maybeProcessReferralCommission error:', e);
  }
}

export async function handleSubscriptionCreated(db: D1Client, event: PolarWebhookEvent) {
  const attrs = event.data.attributes as Record<string, unknown>;
  const subscriptionId = attrs.id as string;
  const customerId = attrs.customer_id as string;
  const productId = attrs.product_id as string;
  const status = attrs.status as string;

  const tier = getTierByProductId(productId);
  if (!tier) throw new WebhookKnownError(`Unknown product ID: ${productId}`);

  const { error } = await db.from('subscriptions').upsert({
    polar_subscription_id: subscriptionId,
    polar_customer_id: customerId,
    polar_product_id: productId,
    tier_name: tier.name,
    status,
    mcu_monthly: tier.mcuMonthly,
    mcu_overage_rate: tier.mcuOverageRate,
    current_period_start: (attrs.current_period_start as string) || null,
    current_period_end: (attrs.current_period_end as string) || null,
    cancel_at_period_end: (attrs.cancel_at_period_end as boolean) || false,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Failed to create subscription: ${error.message}`);

  await maybeProcessReferralCommission(db, customerId, subscriptionId, tier.price);
}

export async function handleSubscriptionUpdated(db: D1Client, event: PolarWebhookEvent) {
  const attrs = event.data.attributes as Record<string, unknown>;
  const subscriptionId = attrs.id as string;
  const status = attrs.status as string;
  const cancelAtPeriodEnd = attrs.cancel_at_period_end as boolean;

  const { error } = await db
    .from('subscriptions')
    .update({ status, cancel_at_period_end: cancelAtPeriodEnd, updated_at: new Date().toISOString() })
    .eq('polar_subscription_id', subscriptionId);

  if (error) throw new Error(`Failed to update subscription: ${error.message}`);
}

export async function handleSubscriptionDeleted(db: D1Client, event: PolarWebhookEvent) {
  const attrs = event.data.attributes as Record<string, unknown>;
  const subscriptionId = attrs.id as string;

  const { error } = await db
    .from('subscriptions')
    .update({ status: 'cancelled', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('polar_subscription_id', subscriptionId);

  if (error) throw new Error(`Failed to cancel subscription: ${error.message}`);
}
