import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ServiceFactory } from '@/lib/services/factory';
import { getProductIdByTier } from '@/lib/polar-config';
import { checkoutSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate body with Zod
    const validation = checkoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { tier } = validation.data;

    // Option D: Single subscription product per tier
    const productId = getProductIdByTier(tier);

    if (!productId) {
      const tokenPrefix = (process.env.POLAR_ACCESS_TOKEN || '').substring(0, 15);
      console.error(`Missing product ID for tier ${tier}. Token prefix: ${tokenPrefix}... Env keys: POLAR_PRODUCT_ID_STARTER=${process.env.POLAR_PRODUCT_ID_STARTER?.substring(0, 8)}, POLAR_PRODUCT_ID_MASTER=${process.env.POLAR_PRODUCT_ID_MASTER?.substring(0, 8)}`);
      if (tier === 'MASTER') {
        return NextResponse.json(
          { error: 'Master tier is coming soon. Please contact support@sophia.agencyos.network for early access.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `Missing product configuration for tier: ${tier}` },
        { status: 400 }
      );
    }

    const headersList = request.headers;
    const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

    // Get user from Supabase auth to pre-fill email if logged in
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Generate guest ID if user not logged in (Polar requires non-empty userId)
    const userId = user?.id || `guest-${Date.now()}`;

    // Create a checkout session via PaymentService (supports Mock Mode)
    const paymentService = ServiceFactory.getPaymentService();

    const checkout = await paymentService.createCheckoutSession({
      productIds: [productId], // Single subscription product
      successUrl: `${origin}/dashboard?checkout=success`,
      customerEmail: user?.email,
      metadata: {
        tier: tier,
        userId: userId,
      }
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Checkout error:', errorMessage, error);
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    );
  }
}
