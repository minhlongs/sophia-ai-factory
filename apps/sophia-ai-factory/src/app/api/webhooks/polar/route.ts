import { verifyWebhookSignature } from '@/lib/polar';
import { getTierFromProductName } from '@/lib/polar-config';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';
import { Tier } from '@/types';
import { TIER_DB_MAPPING } from '@/lib/subscription';

// Initialize Supabase Admin client for database updates
// We use the Service Role Key to bypass RLS since this is a system webhook
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Define minimal event interface
interface WebhookEvent {
  type: string;
  data: {
    id?: string;
    customerEmail?: string;
    customer?: {
      email?: string;
    };
    email?: string;
    product?: {
      name?: string;
    };
    [key: string]: unknown;
  };
  id?: string;
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('webhook-signature');
  const secret = process.env.POLAR_WEBHOOK_SECRET;

  if (!secret) {
    console.error('POLAR_WEBHOOK_SECRET is missing');
    return new NextResponse('Server Configuration Error', { status: 500 });
  }

  if (!signature) {
    return new NextResponse('Missing webhook-signature header', { status: 400 });
  }

  let event: WebhookEvent;

  try {
    const payload = verifyWebhookSignature(body, headersList, secret);
    event = payload as unknown as WebhookEvent;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return new NextResponse('Invalid signature', { status: 400 });
  }

  try {
    const { type, data } = event;
    const email = data.customer?.email || data.email;

    if (!email) {
      console.warn(`No email found in webhook event ${type}`);
      return new NextResponse('Webhook processed but no email found', { status: 200 });
    }

    switch (type) {
      case 'checkout.session.completed':
      case 'order.created':
      case 'subscription.created':
        console.log(`✅ Processing ${type} for ${email}`);

        // Determine tier
        const productName = data.product?.name?.toString() || '';
        const tier = getTierFromProductName(productName);

        // Find user by email
        // Note: In production with many users, this should be optimized to use a dedicated lookup or mapping table if possible
        // But for Supabase Auth, admin.listUsers is the standard way if we don't store email in user_profiles visibly
        // Alternatively, if user_profiles is linked to auth.users, we might query user_profiles if email is there.
        // Assuming email is in Auth.
        const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();
        if (userError || !users) {
            console.error('Failed to list users to find match', userError);
            break;
        }

        const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (user) {
            // Update profile
            const dbTier = TIER_DB_MAPPING[tier];

            const { error: updateError } = await supabaseAdmin
                .from('user_profiles')
                .upsert({
                    user_id: user.id,
                    subscription_tier: dbTier,
                    subscription_status: 'active',
                    updated_at: new Date().toISOString()
                });

            if (updateError) {
                console.error('Failed to update user profile tier', updateError);
            } else {
                console.log(`Updated user ${user.id} to tier ${tier} (${dbTier})`);

                // TRIGGER CAMPAIGN AUTOMATION
                // For 'subscription.created' or 'checkout.session.completed', we trigger a welcome campaign
                if (type === 'subscription.created' || type === 'checkout.session.completed') {
                    // Create a draft campaign record first
                    const { data: campaign, error: campaignError } = await supabaseAdmin
                        .from('campaigns')
                        .insert({
                            user_id: user.id,
                            title: `Welcome to Sophia AI (${tier})`,
                            topic: "Welcome to the future of video automation",
                            audience: "New Subscribers",
                            status: 'queued',
                            progress: 0
                        })
                        .select()
                        .single();

                    if (campaign && !campaignError) {
                        // Trigger Inngest
                        await inngest.send({
                            name: "campaign.created",
                            data: {
                                campaignId: campaign.id,
                                userId: user.id,
                                topic: campaign.topic || "Welcome",
                                audience: campaign.audience || "Subscribers",
                                tier: tier
                            }
                        });
                        console.log(`🚀 Triggered welcome campaign for ${user.id}`);
                    } else {
                        console.error('Failed to create welcome campaign', campaignError);
                    }
                }
            }
        } else {
            console.warn(`No user found for email ${email}`);
        }
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${type}`);
    }

    return new NextResponse('Webhook received', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Error processing webhook', { status: 500 });
  }
}
