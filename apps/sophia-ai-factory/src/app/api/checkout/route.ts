import { polar } from '@/lib/polar';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId' },
        { status: 400 }
      );
    }

    const headersList = request.headers;
    const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create a checkout session
    const checkout = await polar.checkouts.create({
      products: [productId], // Changed from productId to products array
      successUrl: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      // If we have auth, we could pre-fill customer info here
      // customerEmail: user.email,
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
