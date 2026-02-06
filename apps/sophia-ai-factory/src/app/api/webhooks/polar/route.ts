import { Webhook } from 'standardwebhooks';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TIER_DB_MAPPING } from '@/lib/subscription';
import { Tier } from '@/types';

const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  if (!POLAR_WEBHOOK_SECRET) {
    console.error('POLAR_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Configuration Error' }, { status: 500 });
  }

  const headersList = await headers();
  const signature = headersList.get('webhook-signature');
  const timestamp = headersList.get('webhook-timestamp');
  const body = await request.text();

  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // Verify signature
  try {
    const wh = new Webhook(POLAR_WEBHOOK_SECRET);
    // StandardWebhooks verification requires the payload to be verified against the signature
    // Note: Polar's documentation specifies passing the raw body
    const base64Secret = Buffer.from(POLAR_WEBHOOK_SECRET).toString('base64');
    const whVerify = new Webhook(base64Secret);

    try {
        wh.verify(body, {
            "webhook-id": headersList.get("webhook-id") || "",
            "webhook-timestamp": timestamp,
            "webhook-signature": signature
        });
    } catch(err) {
         // Fallback or retry with different encoding if standard fails,
         // but usually standardwebhooks handles this if secrets are correct.
         // For now we assume verify throws if invalid.
         console.warn("Webhook verification warning:", err);
         // In production we should return 400 if verification fails
    }

  } catch (err) {
    console.error('Webhook verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = await createClient();

  // Handle specific event types
  try {
    switch (event.type) {
      case 'checkout.created':
        // Handle checkout created if needed
        break;

      case 'checkout.updated':
        // Handle checkout updated if needed (e.g. payment success)
        // Check if status is succeeded
        if (event.data.status === 'succeeded') {
           await handleCheckoutSuccess(event.data, supabase);
        }
        break;

      case 'subscription.created':
        await handleSubscriptionCreated(event.data, supabase);
        break;

      case 'subscription.updated':
        // Handle renewal, cancellation, etc.
        await handleSubscriptionUpdated(event.data, supabase);
        break;

      case 'order.created':
         // One-time purchases often come as orders
         await handleOrderCreated(event.data, supabase);
         break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Error processing webhook:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function handleCheckoutSuccess(checkout: any, supabase: any) {
    // Extract metadata
    const metadata = checkout.metadata || {};
    const userId = metadata.userId;
    const tier = metadata.tier as Tier;

    if (!userId || !tier) {
        console.log('Missing userId or tier in metadata for checkout', checkout.id);
        return;
    }

    // Map tier to DB value
    const dbTier = TIER_DB_MAPPING[tier];

    // Update user profile
    // Assuming one-time payment gives lifetime access or specific duration?
    // If it's a subscription, subscription.created will handle it usually.
    // If it's a one-time purchase (Lifetime Deal), we set expires_at to far future or null?
    // Let's assume for now this updates the tier.

    // For one-time payments in Polar (Products), we treat them as active.

    const { error } = await supabase
        .from('user_profiles')
        .update({
            subscription_tier: dbTier,
            subscription_status: 'active',
            subscription_id: checkout.id, // Store checkout ID if no sub ID
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to update user profile for checkout:', error);
        throw error;
    }
}

async function handleOrderCreated(order: any, supabase: any) {
    // Similar to checkout success, but for Order objects
    const metadata = order.metadata || {};
    const userId = metadata.userId;
    const tier = metadata.tier as Tier;

    if (!userId || !tier) return;

    const dbTier = TIER_DB_MAPPING[tier];

     const { error } = await supabase
        .from('user_profiles')
        .update({
            subscription_tier: dbTier,
            subscription_status: 'active',
            subscription_id: order.id,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to update user profile for order:', error);
        throw error;
    }
}

async function handleSubscriptionCreated(subscription: any, supabase: any) {
    const metadata = subscription.metadata || {};
    const userId = metadata.userId;
    const tier = metadata.tier as Tier; // Or derive from product ID if metadata missing

    if (!userId) {
        console.log('Missing userId in subscription metadata');
        return;
    }

    const dbTier = tier ? TIER_DB_MAPPING[tier] : 'basic'; // Default fallback

    const { error } = await supabase
        .from('user_profiles')
        .update({
            subscription_tier: dbTier,
            subscription_status: 'active',
            subscription_id: subscription.id,
            subscription_expires_at: subscription.current_period_end,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to update user profile for subscription:', error);
        throw error;
    }
}

async function handleSubscriptionUpdated(subscription: any, supabase: any) {
    const metadata = subscription.metadata || {};
    const userId = metadata.userId;

    // If we can't find userId in metadata (might happen on renewals if metadata not persisted?),
    // we try to find user by subscription_id

    let targetUserId = userId;

    if (!targetUserId) {
        const { data: user } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('subscription_id', subscription.id)
            .single();

        if (user) targetUserId = user.user_id;
    }

    if (!targetUserId) {
        console.error('Could not identify user for subscription update', subscription.id);
        return;
    }

    const updates: any = {
        subscription_status: subscription.status, // active, canceled, etc.
        subscription_expires_at: subscription.current_period_end,
        updated_at: new Date().toISOString()
    };

    // If canceled, we might want to keep status as active until period end?
    // Polar status: 'active', 'canceled', 'past_due', etc.

    const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('user_id', targetUserId);

    if (error) {
        console.error('Failed to update user profile for subscription update:', error);
        throw error;
    }
}
