import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';
import { getTierFromProductName } from '@/lib/lemonsqueezy-config';
import { TIER_DB_MAPPING } from '@/lib/subscription';
import { Tier } from '@/types';

// Lazy init Supabase Admin client
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment variables not configured');
    }
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const headersList = await headers();
    const signature = headersList.get('x-signature');
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    if (!secret) {
      console.error('LEMONSQUEEZY_WEBHOOK_SECRET is missing');
      return new NextResponse('Server Configuration Error', { status: 500 });
    }

    if (!signature) {
      return new NextResponse('Missing signature header', { status: 400 });
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (!crypto.timingSafeEqual(digest, signatureBuffer)) {
      return new NextResponse('Invalid signature', { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    const { meta, data } = payload;
    const eventName = meta.event_name;
    const { attributes } = data;
    const customData = meta.custom_data || {};

    // Handle Order Created
    if (eventName === 'order_created') {
      const userId = customData.userId;
      const tier = customData.tier || getTierFromProductName(attributes.first_order_item?.product_name || '');
      const email = attributes.user_email;

      // Lemon Squeezy Data
      const customerId = attributes.customer_id.toString();
      const orderId = attributes.identifier;
      // If it's a subscription, we might not get the sub ID immediately in order_created unless we check relationships
      // But usually we can rely on subscription_created event for the sub ID.
      // However, sometimes it is nice to link immediately if possible.

      let user;
      if (userId) {
        const { data: userData, error } = await getSupabaseAdmin().auth.admin.getUserById(userId);
        if (!error) user = userData.user;
      }

      if (!user && email) {
        console.warn('User ID not found in metadata, skipping email lookup for security/performance.');
      }

      if (user) {
        const dbTier = TIER_DB_MAPPING[tier as Tier];

        const { error: updateError } = await getSupabaseAdmin()
          .from('user_profiles')
          .upsert({
            user_id: user.id,
            subscription_tier: dbTier,
            subscription_status: 'active',
            lemonsqueezy_customer_id: customerId,
            lemonsqueezy_order_id: orderId,
            updated_at: new Date().toISOString()
          });

        if (updateError) {
          console.error('Failed to update user profile tier', updateError);
        } else {
          await triggerWelcomeCampaign(user.id, tier, dbTier);
        }
      } else {
        console.warn(`User not found for order ${data.id}`);
      }
    }

    // Handle Subscription Created/Updated
    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      const userId = customData.userId; // Usually passed in subscription custom data if passed in checkout
      const email = attributes.user_email;
      const status = attributes.status; // active, past_due, etc.
      const customerId = attributes.customer_id.toString();
      const subscriptionId = data.id.toString();
      const orderId = attributes.order_id.toString();
      const productName = attributes.product_name;
      const tier = getTierFromProductName(productName);
      const renewsAt = attributes.renews_at;
      const endsAt = attributes.ends_at;

      // Determine expiration date
      // If active, it expires at renews_at (next billing)
      // If cancelled, it expires at ends_at
      const expiresAt = endsAt || renewsAt;

      // We need to find the user.
      // If custom_data.userId is present, great.
      // If not, we can try to look up by lemonsqueezy_customer_id if we saved it from order_created.

      let user = null;

      if (userId) {
         const { data: userData } = await getSupabaseAdmin().auth.admin.getUserById(userId);
         if (userData) user = userData.user;
      }

      if (!user) {
         // Try lookup by customer_id
         const { data: profileData } = await getSupabaseAdmin()
            .from('user_profiles')
            .select('user_id')
            .eq('lemonsqueezy_customer_id', customerId)
            .single();

         if (profileData) {
            // Get user object not strictly needed if we just update profile,
            // but consistent with code above.
            user = { id: profileData.user_id };
         }
      }

      if (user) {
         const dbTier = TIER_DB_MAPPING[tier as Tier];

         const { error: updateError } = await getSupabaseAdmin()
          .from('user_profiles')
          .update({
            subscription_status: status,
            lemonsqueezy_subscription_id: subscriptionId,
            lemonsqueezy_customer_id: customerId, // Ensure it's set
            subscription_tier: status === 'active' ? dbTier : undefined, // Only update tier if active? Or keep last known?
            // Actually, if it's updated (upgraded/downgraded), we should update tier.
            // If expired, we might want to downgrade to free or keep record but mark status.
            subscription_expires_at: expiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

         if (updateError) {
             console.error('Failed to update subscription status', updateError);
         }
      } else {
          console.warn(`Could not find user for subscription event ${eventName} (sub: ${subscriptionId})`);
      }
    }

    // Handle Subscription Cancelled/Expired
    if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
       const subscriptionId = data.id.toString();
       const status = attributes.status; // cancelled, expired

       const { error } = await getSupabaseAdmin()
         .from('user_profiles')
         .update({
            subscription_status: status,
            // subscription_tier: 'free' // Optional: Downgrade immediately? Or wait for period end?
            // Lemon Squeezy "cancelled" means "will expire at period end" usually?
            // No, "cancelled" status in LS means it's cancelled. "on_grace_period" means will expire.
            // Let's just update status for now.
            updated_at: new Date().toISOString()
         })
         .eq('lemonsqueezy_subscription_id', subscriptionId);

       if (error) console.error('Failed to cancel subscription', error);
    }

    return new NextResponse('Webhook processed', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function triggerWelcomeCampaign(userId: string, tier: Tier, dbTier: string) {
    // Trigger Welcome Campaign
    const { data: campaign, error: campaignError } = await getSupabaseAdmin()
    .from('campaigns')
    .insert({
        user_id: userId,
        title: `Welcome to Sophia AI (${tier})`,
        topic: "Welcome to the future of video automation",
        audience: "New Subscribers",
        status: 'queued',
        progress: 0
    })
    .select()
    .single();

    if (campaign && !campaignError) {
        await inngest.send({
            name: "campaign.created",
            data: {
            campaignId: campaign.id,
            userId: userId,
            topic: campaign.topic || "Welcome",
            audience: campaign.audience || "Subscribers",
            tier: tier
            }
        });
    } else {
        console.error('Failed to create welcome campaign', campaignError);
    }
}
