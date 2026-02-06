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

    // Handle checkout completed
    if (payload.type === 'checkout.created' || payload.type === 'order.paid') {
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

      // Update user tier in Supabase
      const { error } = await getSupabase()
        .from('user_profiles')
        .upsert({
          user_id: userId,
          subscription_tier: tier,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('[Polar Webhook] Failed to update tier:', error);
      } else {
        console.log(`[Polar Webhook] Updated user ${userId} to tier: ${tier}`);
      }
    }

    // Handle subscription cancelled
    if (payload.type === 'subscription.canceled') {
      const data = payload.data as { metadata?: { userId?: string } };
      const userId = data.metadata?.userId;
      
      if (userId) {
        await getSupabase()
          .from('user_profiles')
          .update({ 
            subscription_tier: 'basic',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        
        console.log(`[Polar Webhook] Downgraded user ${userId} to basic`);
      }
    }
  },
});
