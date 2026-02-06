import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ServiceFactory } from '@/lib/services/factory';
import { getProductIdByTier } from '@/lib/polar-config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tier, productId } = body;

    // Determine Product ID either from direct ID or Tier mapping
    let finalProductId = productId;
    if (!finalProductId && tier) {
      finalProductId = getProductIdByTier(tier as string);
    }

    if (!finalProductId) {
      return NextResponse.json(
        { error: 'Missing productId or valid tier' },
        { status: 400 }
      );
    }

    const headersList = request.headers;
    const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Get user from Supabase auth to pre-fill email if logged in
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Create a checkout session via PaymentService (supports Mock Mode)
    const paymentService = ServiceFactory.getPaymentService();

    const checkout = await paymentService.createCheckoutSession({
      productId: finalProductId,
      successUrl: `${origin}/dashboard?checkout=success`, // Lemon Squeezy doesn't support session_id injection in success URL simply like Stripe/Polar sometimes do, but we get order details in webhook
      customerEmail: user?.email,
      metadata: {
        tier: tier || 'BASIC',
        userId: user?.id || '',
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
