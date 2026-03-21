/**
 * POST /api/webhooks/polar
 *
 * Handles Polar.sh webhook events:
 * - subscription.created: New subscription created (+ referral commission trigger)
 * - subscription.updated: Subscription modified
 * - subscription.deleted: Subscription cancelled
 * - order.paid: Payment successful (credit MCU)
 * - order.refunded: Payment refunded (deduct MCU)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { getPolarClient, PolarWebhookEvent } from '@/lib/billing/polar-client';
import { getTierByProductId } from '@/lib/billing/mcu-pricing';
import { createHash } from 'crypto';

// Webhook is public - Polar needs to access it without auth
export const config = {
  api: {
    bodyParser: false,
  },
};

// In-memory store for processed event IDs (deduplication)
// In production, use a database table with unique constraint
const processedEvents = new Map<string, number>();
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Clean old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [eventId, timestamp] of processedEvents.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      processedEvents.delete(eventId);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

export async function POST(request: NextRequest) {
  try {
    // 1. Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-polar-signature') || '';

    // 2. Verify webhook signature
    const polarClient = getPolarClient();
    const isValid = polarClient.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 3. Parse webhook event
    let event: PolarWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch (error) {
      console.error('Failed to parse webhook payload:', error);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // SECURITY: Event deduplication (prevent replay attacks)
    const eventId = event.data.id;
    const eventTimestamp = Date.now();

    if (processedEvents.has(eventId)) {
      const lastProcessed = processedEvents.get(eventId)!;
      if (eventTimestamp - lastProcessed < DEDUP_WINDOW_MS) {
        console.log(`Duplicate webhook event rejected: ${eventId}`);
        return NextResponse.json({ received: true, duplicate: true });
      }
    }
    processedEvents.set(eventId, eventTimestamp);

    console.log(`Processing Polar webhook: ${event.type} (id: ${eventId})`);

    // 4. Route to handler based on event type
    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(event);
        break;
      case 'subscription.updated':
        await handleSubscriptionUpdated(event);
        break;
      case 'subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
      case 'order.paid':
        await handleOrderPaid(event);
        break;
      case 'order.refunded':
        await handleOrderRefunded(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // 5. Return success
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);

    // Return 200 to prevent Polar from retrying on known errors
    if (error instanceof WebhookKnownError) {
      console.error('Known webhook error (not retrying):', error.message);
      return NextResponse.json({ received: true, error: error.message });
    }

    // Return 500 for unknown errors (Polar will retry)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Custom error class for known errors (no retry)
class WebhookKnownError extends Error {}

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(event: PolarWebhookEvent) {
  const supabase = createServerClient();
  const attrs = event.data.attributes as Record<string, unknown>;

  const subscriptionId = attrs.id as string;
  const customerId = attrs.customer_id as string;
  const productId = attrs.product_id as string;
  const status = attrs.status as string;

  // Get tier info from product ID
  const tier = getTierByProductId(productId);
  if (!tier) {
    throw new WebhookKnownError(`Unknown product ID: ${productId}`);
  }

  // Upsert subscription record
  const { error } = await supabase.from('subscriptions').upsert({
    polar_subscription_id: subscriptionId,
    polar_customer_id: customerId,
    polar_product_id: productId,
    tier_name: tier.name,
    status: status,
    mcu_monthly: tier.mcuMonthly,
    mcu_overage_rate: tier.mcuOverageRate,
    current_period_start: attrs.current_period_start as string || null,
    current_period_end: attrs.current_period_end as string || null,
    cancel_at_period_end: attrs.cancel_at_period_end as boolean || false,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'polar_subscription_id'
  });

  if (error) {
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  console.log(`Subscription created: ${subscriptionId} (${tier.name})`);

  // Trigger referral commission if org signed up via a referral code
  await maybeProcessReferralCommission(supabase, customerId, subscriptionId, tier.price);
}

/**
 * If the org that just subscribed came via a referral code,
 * call /api/referral/earn to credit the referrer.
 *
 * referral_code is stored in billing_settings.metadata->referral_code at signup.
 */
async function maybeProcessReferralCommission(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  subscriptionId: string,
  subscriptionAmountCents: number
) {
  try {
    // Find org and check for referral_code in billing_settings metadata
    const { data: billing } = await supabase
      .from('billing_settings')
      .select('org_id, metadata')
      .eq('polar_customer_id', customerId)
      .single();

    if (!billing?.org_id) return;

    const referralCode = (billing.metadata as Record<string, string> | null)?.referral_code;
    if (!referralCode) return;

    // Call earn endpoint server-to-server
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
      const body = await res.json().catch(() => ({}));
      console.error('Referral earn call failed:', body);
    } else {
      const result = await res.json();
      console.log(`Referral commission processed for code ${referralCode}:`, result);
    }
  } catch (e) {
    // Non-fatal: log but don't fail the webhook
    console.error('maybeProcessReferralCommission error:', e);
  }
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(event: PolarWebhookEvent) {
  const supabase = createServerClient();
  const attrs = event.data.attributes as Record<string, unknown>;

  const subscriptionId = attrs.id as string;
  const status = attrs.status as string;
  const cancelAtPeriodEnd = attrs.cancel_at_period_end as boolean;

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('polar_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  console.log(`Subscription updated: ${subscriptionId} (status: ${status})`);
}

/**
 * Handle subscription.deleted event
 */
async function handleSubscriptionDeleted(event: PolarWebhookEvent) {
  const supabase = createServerClient();
  const attrs = event.data.attributes as Record<string, unknown>;

  const subscriptionId = attrs.id as string;

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('polar_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }

  console.log(`Subscription cancelled: ${subscriptionId}`);
}

/**
 * Handle order.paid event (CREDIT MCU)
 */
async function handleOrderPaid(event: PolarWebhookEvent) {
  const supabase = createServerClient();
  const attrs = event.data.attributes as Record<string, unknown>;

  const orderId = attrs.id as string;
  const customerId = attrs.customer_id as string;
  const amount = attrs.amount as number; // In cents
  const polarProductId = attrs.product_id as string | undefined;

  // SECURITY: Validate amount > 0 (prevent negative amount exploits)
  if (!amount || amount <= 0) {
    throw new WebhookKnownError(
      `Invalid order amount: ${amount}. Amount must be > 0`
    );
  }

  // SECURITY: Strict polarProductId validation
  if (!polarProductId) {
    throw new WebhookKnownError(
      'Missing product_id in order.paid event'
    );
  }

  // Verify product_id matches known tiers
  const tier = getTierByProductId(polarProductId);
  if (!tier) {
    throw new WebhookKnownError(
      `Unknown product ID: ${polarProductId}. Must be a valid tier.`
    );
  }

  // IDEMPOTENCY: Check if already processed (using order ID as idempotency key)
  const { data: existingTransaction } = await supabase
    .from('transactions')
    .select('id')
    .eq('polar_order_id', orderId)
    .eq('type', 'credit')
    .single();

  if (existingTransaction) {
    console.log(`Order ${orderId} already processed - skipping (idempotent)`);
    return;
  }

  // Find the organization by Polar customer ID
  const { data: billingSettings } = await supabase
    .from('billing_settings')
    .select('org_id')
    .eq('polar_customer_id', customerId)
    .single();

  if (!billingSettings?.org_id) {
    throw new WebhookKnownError(
      `Organization not found for customer: ${customerId}`
    );
  }

  // Credit MCU based on tier (not from amount to prevent manipulation)
  const mcuToCredit = tier.mcuMonthly;

  // Credit MCU balance using database function with idempotency key
  const { error } = await supabase.rpc('credit_mcu_balance', {
    p_org_id: billingSettings.org_id,
    p_amount: mcuToCredit,
    p_subscription_id: orderId,
  });

  if (error) {
    throw new Error(`Failed to credit MCU: ${error.message}`);
  }

  // Record transaction for idempotency
  await supabase.from('transactions').insert({
    org_id: billingSettings.org_id,
    type: 'credit',
    amount: mcuToCredit,
    polar_order_id: orderId,
    polar_customer_id: customerId,
    polar_product_id: polarProductId,
    tier_name: tier.name,
    created_at: new Date().toISOString(),
  });

  console.log(
    `Order paid: ${orderId} - Credited ${mcuToCredit} MCU to org ${billingSettings.org_id} (${tier.name})`
  );
}

/**
 * Handle order.refunded event (DEDUCT MCU)
 */
async function handleOrderRefunded(event: PolarWebhookEvent) {
  const supabase = createServerClient();
  const attrs = event.data.attributes as Record<string, unknown>;

  const orderId = attrs.id as string;
  const customerId = attrs.customer_id as string;
  const amount = attrs.amount as number;
  const polarProductId = attrs.product_id as string | undefined;

  // SECURITY: Validate amount > 0 (prevent negative amount exploits)
  if (!amount || amount <= 0) {
    throw new WebhookKnownError(
      `Invalid refund amount: ${amount}. Amount must be > 0`
    );
  }

  // SECURITY: Strict polarProductId validation
  if (!polarProductId) {
    throw new WebhookKnownError(
      'Missing product_id in order.refunded event'
    );
  }

  // Verify product_id matches known tiers
  const tier = getTierByProductId(polarProductId);
  if (!tier) {
    throw new WebhookKnownError(
      `Unknown product ID: ${polarProductId}. Must be a valid tier.`
    );
  }

  // IDEMPOTENCY: Check if already processed
  const { data: existingTransaction } = await supabase
    .from('transactions')
    .select('id')
    .eq('polar_order_id', orderId)
    .eq('type', 'debit')
    .single();

  if (existingTransaction) {
    console.log(`Refund ${orderId} already processed - skipping (idempotent)`);
    return;
  }

  // Find the organization
  const { data: billingSettings } = await supabase
    .from('billing_settings')
    .select('org_id')
    .eq('polar_customer_id', customerId)
    .single();

  if (!billingSettings?.org_id) {
    throw new WebhookKnownError(
      `Organization not found for customer: ${customerId}`
    );
  }

  // Deduct MCU based on tier (not from amount to prevent manipulation)
  const mcuToDeduct = tier.mcuMonthly;

  // Get current balance
  const { data: currentBalance } = await supabase
    .from('org_balances')
    .select('balance')
    .eq('org_id', billingSettings.org_id)
    .single();

  const newBalance = (currentBalance?.balance || 0) - mcuToDeduct;

  const { error } = await supabase
    .from('org_balances')
    .update({
      balance: newBalance,
      last_updated: new Date().toISOString(),
    })
    .eq('org_id', billingSettings.org_id);

  if (error) {
    throw new Error(`Failed to deduct MCU: ${error.message}`);
  }

  // Record transaction for idempotency
  await supabase.from('transactions').insert({
    org_id: billingSettings.org_id,
    type: 'debit',
    amount: mcuToDeduct,
    polar_order_id: orderId,
    polar_customer_id: customerId,
    polar_product_id: polarProductId,
    tier_name: tier.name,
    created_at: new Date().toISOString(),
  });

  console.log(
    `Order refunded: ${orderId} - Deducted ${mcuToDeduct} MCU from org ${billingSettings.org_id} (${tier.name})`
  );
}

/**
 * Calculate MCU from payment amount (fallback)
 */
function calculateMcuFromAmount(amountCents: number): number {
  // Rough calculation: $1 = 20 MCU (adjust based on pricing)
  const amountDollars = amountCents / 100;
  return Math.floor(amountDollars * 20);
}
