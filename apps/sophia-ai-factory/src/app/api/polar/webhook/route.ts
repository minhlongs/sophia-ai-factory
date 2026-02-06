import { Webhooks } from "@polar-sh/nextjs";
import { createClient } from "@supabase/supabase-js";

// Lazy init Supabase for build compatibility
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabaseAdmin;
}

// Tier mapping from Polar product to our tier names
const PRODUCT_TO_TIER: Record<string, string> = {
  [process.env.NEXT_PUBLIC_POLAR_PRODUCT_STARTER || '']: 'basic',
  [process.env.NEXT_PUBLIC_POLAR_PRODUCT_GROWTH || '']: 'pro',
  [process.env.NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM || '']: 'enterprise',
};

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    console.log('[Polar Webhook] Received:', payload.type);

    const supabase = getSupabase();

    // Handle one-time purchase
    if (payload.type === 'order.paid') {
      const data = payload.data as {
        customer_email?: string;
        metadata?: { userId?: string; tier?: string };
        product_id?: string;
      };

      const userId = data.metadata?.userId;
      const productId = data.product_id;
      
      if (!userId) {
        console.log('[Polar Webhook] No userId in metadata');
        return;
      }

      const tier = productId ? PRODUCT_TO_TIER[productId] : data.metadata?.tier?.toLowerCase();
      
      if (!tier) {
        console.log('[Polar Webhook] Could not determine tier');
        return;
      }

      // Update user tier - one-time purchase = lifetime access? or need maintenance?
      // For now: set tier, no expiration for one-time
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          subscription_tier: tier,
          polar_customer_id: data.customer_email, // Store for portal access
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('[Polar Webhook] Failed to update tier:', error);
      } else {
        console.log(`[Polar Webhook] Updated user ${userId} to tier: ${tier}`);
      }
    }

    // Handle subscription created/renewed - MONTHLY MAINTENANCE
    if (payload.type === 'subscription.active' || payload.type === 'subscription.updated') {
      const data = payload.data as {
        metadata?: { userId?: string };
        product_id?: string;
        current_period_end?: string; // Expiration date
        customer_id?: string;
      };

      const userId = data.metadata?.userId;
      if (!userId) return;

      const tier = data.product_id ? PRODUCT_TO_TIER[data.product_id] : null;
      
      // Set tier with expiration date
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          subscription_tier: tier || 'basic',
          subscription_expires_at: data.current_period_end || null,
          polar_customer_id: data.customer_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      console.log(`[Polar Webhook] Subscription active for ${userId}, expires: ${data.current_period_end}`);
    }

    // Handle subscription cancelled - DOWNGRADE IMMEDIATELY or at period end
    if (payload.type === 'subscription.canceled') {
      const data = payload.data as { 
        metadata?: { userId?: string };
        cancel_at_period_end?: boolean;
        current_period_end?: string;
      };
      const userId = data.metadata?.userId;
      
      if (userId) {
        if (data.cancel_at_period_end) {
          // Cancel at end of period - keep tier until expiration
          await supabase
            .from('user_profiles')
            .update({ 
              subscription_expires_at: data.current_period_end,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
          
          console.log(`[Polar Webhook] User ${userId} cancel scheduled at ${data.current_period_end}`);
        } else {
          // Immediate cancel - downgrade now
          await supabase
            .from('user_profiles')
            .update({ 
              subscription_tier: 'basic',
              subscription_expires_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
          
          console.log(`[Polar Webhook] Downgraded user ${userId} to basic immediately`);
        }
      }
    }

    // Handle payment failed - could downgrade or send warning
    if (payload.type === 'subscription.revoked') {
      const data = payload.data as { metadata?: { userId?: string } };
      const userId = data.metadata?.userId;
      
      if (userId) {
        await supabase
          .from('user_profiles')
          .update({ 
            subscription_tier: 'basic',
            subscription_expires_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        console.log(`[Polar Webhook] Subscription revoked for ${userId}, downgraded to basic`);
      }
    }
  },
});
