/**
 * POST /api/billing/checkout
 *
 * Creates a Polar checkout session for subscription purchase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { getCurrentUser } from '@/lib/supabase/auth';
import { getPolarClient, POLAR_TIERS } from '@/lib/billing/polar-client';
import { z } from 'zod';

const CheckoutRequestSchema = z.object({
  tier: z.enum(['starter', 'growth', 'premium', 'master']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user from request cookies
    const cookies = request.headers.get('cookie') || '';
    const user = await getCurrentUser(cookies);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request
    const body = await request.json();
    const validated = CheckoutRequestSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { tier: tierName, successUrl, cancelUrl } = validated.data;
    const tier = POLAR_TIERS[tierName];
    const polarProductId = tier.polarProductId;

    if (!polarProductId) {
      console.error(`Polar product ID not configured for tier: ${tierName}`);
      return NextResponse.json(
        { error: 'Product configuration error' },
        { status: 500 }
      );
    }

    // 3. Get user's organization and email
    const supabase = createServerClient();
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: 'User not associated with any organization' },
        { status: 400 }
      );
    }

    const { data: userData } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single();

    if (!userData?.email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // 4. Check if customer already exists in Polar
    const polarClient = getPolarClient();
    const existingCustomer = await polarClient.getCustomerByEmail(userData.email);

    // 5. Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const checkout = await polarClient.createCheckoutSession(
      polarProductId,
      userData.email,
      successUrl || `${baseUrl}/billing/success`,
      cancelUrl || `${baseUrl}/billing/cancel`
    );

    // 6. Store pending subscription intent
    await supabase.from('billing_settings').upsert({
      org_id: orgMember.org_id,
      polar_customer_id: existingCustomer?.id || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'org_id'
    });

    // 7. Return checkout URL
    return NextResponse.json({
      url: checkout.url,
      tier: tierName,
      price: tier.price / 100,
      mcuMonthly: tier.mcuMonthly,
    });

  } catch (error) {
    console.error('Checkout error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
