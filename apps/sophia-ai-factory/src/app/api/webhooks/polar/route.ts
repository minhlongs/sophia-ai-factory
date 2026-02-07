import { Webhook } from 'standardwebhooks';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TIER_DB_MAPPING } from '@/lib/subscription';
import { Tier } from '@/types';
import { webhookHeaderSchema } from '@/lib/schemas';
import { Database } from '@/lib/supabase/types';

const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET!;

type SubscriptionTier = Database['public']['Tables']['user_profiles']['Row']['subscription_tier'];

export async function POST(request: Request) {
  if (!POLAR_WEBHOOK_SECRET) {
    console.error('POLAR_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Configuration Error' }, { status: 500 });
  }

  const headersList = await headers();
  const body = await request.text();

  // Validate webhook headers with Zod
  const headerValidation = webhookHeaderSchema.safeParse({
    "webhook-id": headersList.get('webhook-id'),
    "webhook-timestamp": headersList.get('webhook-timestamp'),
    "webhook-signature": headersList.get('webhook-signature'),
  });

  if (!headerValidation.success) {
    console.error('Invalid webhook headers:', headerValidation.error);
    return NextResponse.json({ error: 'Invalid headers' }, { status: 400 });
  }

  const { "webhook-signature": signature, "webhook-timestamp": timestamp } = headerValidation.data;

  // Verify signature
  try {
    const wh = new Webhook(POLAR_WEBHOOK_SECRET);
    // StandardWebhooks verification requires the payload to be verified against the signature
    // Note: Polar's documentation specifies passing the raw body
    const base64Secret = Buffer.from(POLAR_WEBHOOK_SECRET).toString('base64');
    
    // We try verifying with the provided secret directly first (standard way)
    // If that fails, we might try other ways if needed, but usually standardwebhooks handles it.
    
    try {
        wh.verify(body, {
            "webhook-id": headersList.get("webhook-id") || "",
            "webhook-timestamp": timestamp,
            "webhook-signature": signature
        });
    } catch(err) {
         // Fallback logic or detailed logging
         console.warn("Webhook verification warning:", err);
         
         // Let's try re-verifying with base64 secret just in case (some integrations encode it)
         try {
             const whVerify = new Webhook(base64Secret);
             whVerify.verify(body, {
                "webhook-id": headersList.get("webhook-id") || "",
                "webhook-timestamp": timestamp,
                "webhook-signature": signature
             });
         } catch {
             console.error("Webhook verification failed with both raw and base64 secret");
             throw err; // Re-throw original error or the new one
         }
    }

  } catch (err) {
    console.error('Webhook verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
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
  } catch (err: unknown) {
    console.error('Error processing webhook:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function handleCheckoutSuccess(checkout: Record<string, unknown>, supabase: Awaited<ReturnType<typeof createClient>>) {
    // Extract metadata
    const metadata = (checkout.metadata || {}) as Record<string, unknown>;
    const userId = metadata.userId as string | undefined;
    const tier = metadata.tier as Tier;

    if (!userId || !tier) {
        console.log('Missing userId or tier in metadata for checkout', checkout.id);
        return;
    }

    // Map tier to DB value
    const dbTier = TIER_DB_MAPPING[tier] as SubscriptionTier;

    // Update user profile
    const { error } = await supabase
        .from('user_profiles')
        .update({
            subscription_tier: dbTier,
            subscription_status: 'active',
            polar_subscription_id: checkout.id as string, 
            updated_at: new Date().toISOString()
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to update user profile for checkout:', error);
        throw error;
    }
}

async function handleOrderCreated(order: Record<string, unknown>, supabase: Awaited<ReturnType<typeof createClient>>) {
    // Similar to checkout success, but for Order objects
    const metadata = (order.metadata || {}) as Record<string, unknown>;
    const userId = metadata.userId as string | undefined;
    const tier = metadata.tier as Tier;

    if (!userId || !tier) return;

    const dbTier = TIER_DB_MAPPING[tier] as SubscriptionTier;

     const { error } = await supabase
        .from('user_profiles')
        .update({
            subscription_tier: dbTier,
            subscription_status: 'active',
            polar_subscription_id: order.id as string,
            updated_at: new Date().toISOString()
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to update user profile for order:', error);
        throw error;
    }
}

async function handleSubscriptionCreated(subscription: Record<string, unknown>, supabase: Awaited<ReturnType<typeof createClient>>) {
    const metadata = (subscription.metadata || {}) as Record<string, unknown>;
    const userId = metadata.userId as string | undefined;
    const tier = metadata.tier as Tier; // Or derive from product ID if metadata missing

    if (!userId) {
        console.log('Missing userId in subscription metadata');
        return;
    }

    const dbTier = (tier ? TIER_DB_MAPPING[tier] : 'basic') as SubscriptionTier;

    const { error } = await supabase
        .from('user_profiles')
        .update({
            subscription_tier: dbTier,
            subscription_status: 'active',
            polar_subscription_id: subscription.id as string,
            subscription_expires_at: (subscription.current_period_end as string) || null,
            updated_at: new Date().toISOString()
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('user_id', userId);

    if (error) {
        console.error('Failed to update user profile for subscription:', error);
        throw error;
    }
}

async function handleSubscriptionUpdated(subscription: Record<string, unknown>, supabase: Awaited<ReturnType<typeof createClient>>) {
    const metadata = (subscription.metadata || {}) as Record<string, unknown>;
    const userId = metadata.userId as string | undefined;

    // If we can't find userId in metadata (might happen on renewals if metadata not persisted?),
    // we try to find user by polar_subscription_id

    let targetUserId = userId;

    if (!targetUserId) {
        const { data: user } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('polar_subscription_id', subscription.id)
            .single();

        if (user) targetUserId = user.user_id;
    }

    if (!targetUserId) {
        console.error('Could not identify user for subscription update', subscription.id);
        return;
    }

    const updates = {
        subscription_status: subscription.status as string,
        subscription_expires_at: (subscription.current_period_end as string) || null,
        updated_at: new Date().toISOString()
    };

    const { error } = await supabase
        .from('user_profiles')
        .update(updates as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .eq('user_id', targetUserId);

    if (error) {
        console.error('Failed to update user profile for subscription update:', error);
        throw error;
    }
}
