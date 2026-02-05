import { polar } from '@/lib/polar';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TIER_PRODUCT_MAP: Record<string, string> = {
  BASIC: process.env.POLAR_PRODUCT_BASIC_ID || '',
  PREMIUM: process.env.POLAR_PRODUCT_PREMIUM_ID || '',
  ENTERPRISE: process.env.POLAR_PRODUCT_ENTERPRISE_ID || '',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tier, productId } = body;

    // Determine Product ID either from direct ID or Tier mapping
    let finalProductId = productId;
    if (!finalProductId && tier && TIER_PRODUCT_MAP[tier as string]) {
      finalProductId = TIER_PRODUCT_MAP[tier as string];
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

    // Create a checkout session
    const checkout = await polar.checkouts.create({
      products: [finalProductId],
      successUrl: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      ...(user?.email ? { customerEmail: user.email } : {}),
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
