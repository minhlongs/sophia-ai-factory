/**
 * GET /api/billing/portal
 *
 * Creates a customer portal session for subscription management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/db/auth';
import { getPolarClient } from '@/lib/billing/polar-client';

export async function GET(request: NextRequest) {
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

    // 2. Get user's organization
    const db = createServerClient();
    const { data: orgMember } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // 3. Get billing settings for organization
    const { data: billingSettings } = await db
      .from('billing_settings')
      .select('polar_customer_id')
      .eq('org_id', orgMember.org_id)
      .single();

    if (!billingSettings?.polar_customer_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // 4. Create portal session
    const polarClient = getPolarClient();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const portal = await polarClient.createPortalSession(
      billingSettings.polar_customer_id,
      `${baseUrl}/billing`
    );

    return NextResponse.json({ url: portal.url });

  } catch (error) {
    console.error('Portal error:', error);

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
