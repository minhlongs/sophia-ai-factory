import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ServiceFactory } from '@/lib/services/factory';
import { getProductIdByTier } from '@/lib/polar-config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tier } = body;

    if (!tier) {
      return NextResponse.json(
        { error: 'Missing tier' },
        { status: 400 }
      );
    }

    // Get BOTH product IDs: one-time setup + monthly subscription
    const onetimeProductId = getProductIdByTier(tier as string, 'one-time');
    const monthlyProductId = getProductIdByTier(tier as string, 'monthly');

    if (!onetimeProductId || !monthlyProductId) {
      console.error(`Missing product IDs for tier ${tier}:`, { onetimeProductId, monthlyProductId });
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
      productIds: [onetimeProductId, monthlyProductId], // Bundle: one-time + monthly
      successUrl: `${origin}/dashboard?checkout=success`,
      customerEmail: user?.email,
      metadata: {
        tier: tier,
        userId: userId,
      }
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
