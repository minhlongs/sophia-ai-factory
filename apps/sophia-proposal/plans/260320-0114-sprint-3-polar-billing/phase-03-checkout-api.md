---
title: "Phase 3 — Checkout API Endpoints"
priority: P1
status: completed
effort: 2h
---

# PHASE 3 — CHECKOUT API ENDPOINTS

## Overview

Create Next.js API routes for Polar checkout session creation, customer portal, and subscription management.

## Files to Create

### app/api/billing/checkout/route.ts

```typescript
/**
 * POST /api/billing/checkout
 *
 * Creates a Polar checkout session for subscription purchase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth'; // Or your auth solution
import { createServerClient } from '@/lib/supabase/client';
import { getPolarClient, POLAR_TIERS } from '@/lib/billing/polar-client';
import { z } from 'zod';

const CheckoutRequestSchema = z.object({
  tier: z.enum(['starter', 'growth', 'premium', 'master']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(); // Adapt to your auth
    if (!session?.user) {
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
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', session.user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: 'User not associated with any organization' },
        { status: 400 }
      );
    }

    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', session.user.id)
      .single();

    if (!user?.email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // 4. Check if customer already exists in Polar
    const polarClient = getPolarClient();
    const existingCustomer = await polarClient.getCustomerByEmail(user.email);

    // 5. Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const checkout = await polarClient.createCheckoutSession(
      polarProductId,
      user.email,
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
      price: tier.price / 100, // Convert cents to dollars
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
```

### app/api/billing/portal/route.ts

```typescript
/**
 * GET /api/billing/portal
 *
 * Creates a customer portal session for subscription management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createServerClient } from '@/lib/supabase/client';
import { getPolarClient } from '@/lib/billing/polar-client';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get user's organization
    const supabase = createServerClient();
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', session.user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // 3. Get billing settings for organization
    const { data: billingSettings } = await supabase
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
```

### app/api/billing/subscription/route.ts

```typescript
/**
 * GET /api/billing/subscription
 *
 * Returns current subscription status for the user's organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createServerClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get user's organization
    const supabase = createServerClient();
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', session.user.id)
      .single();

    if (!orgMember) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // 3. Get subscription and balance
    const [subscriptionResult, balanceResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('org_id', orgMember.org_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
        .then(r => r.data),

      supabase
        .from('org_balances')
        .select('*')
        .eq('org_id', orgMember.org_id)
        .single()
        .then(r => r.data),
    ]);

    return NextResponse.json({
      subscription: subscriptionResult ? {
        id: subscriptionResult.id,
        tierName: subscriptionResult.tier_name,
        status: subscriptionResult.status,
        mcuMonthly: subscriptionResult.mcu_monthly,
        currentPeriodEnd: subscriptionResult.current_period_end,
        cancelAtPeriodEnd: subscriptionResult.cancel_at_period_end,
      } : null,
      balance: balanceResult ? {
        balance: balanceResult.balance,
        lifetimeCredits: balanceResult.lifetime_credits,
        lifetimeUsed: balanceResult.lifetime_used,
      } : null,
    });

  } catch (error) {
    console.error('Subscription fetch error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Implementation Steps

1. Create `app/api/billing/checkout/route.ts`
2. Create `app/api/billing/portal/route.ts`
3. Create `app/api/billing/subscription/route.ts`
4. Update auth integration to match project's auth solution
5. Test endpoints with curl or Postman

## Testing Commands

```bash
# Test checkout creation
curl -X POST http://localhost:3000/api/billing/checkout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "premium"}'

# Test subscription fetch
curl -X GET http://localhost:3000/api/billing/subscription \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test portal creation
curl -X GET http://localhost:3000/api/billing/portal \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Success Criteria

- [x] Checkout endpoint returns valid Polar URL
- [x] Portal endpoint returns valid portal URL
- [x] Subscription endpoint returns current status
- [x] Proper error handling for edge cases
- [x] TypeScript compilation passes

**Completed:** 2026-03-20

## Related Files

- Checkout: `app/api/billing/checkout/route.ts`
- Portal: `app/api/billing/portal/route.ts`
- Subscription: `app/api/billing/subscription/route.ts`
- Polar Client: `lib/billing/polar-client.ts`
