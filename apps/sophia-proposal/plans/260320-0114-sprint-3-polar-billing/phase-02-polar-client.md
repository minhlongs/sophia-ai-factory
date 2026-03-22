---
title: "Phase 2 — Polar Client Library"
priority: P1
status: completed
effort: 1.5h
completed_at: 2026-03-20
---

# PHASE 2 — POLAR CLIENT LIBRARY

## Overview

Create TypeScript client for Polar.sh API integration with proper error handling and type safety.

## Files to Create

### lib/billing/polar-client.ts

```typescript
/**
 * Polar.sh API Client
 *
 * Handles:
 * - Checkout session creation
 * - Customer portal sessions
 * - Subscription management
 * - Webhook signature verification
 */

import { z } from 'zod';

// Schema definitions
export const PolarCheckoutSchema = z.object({
  product_id: z.string(),
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  customer_organization: z.string().optional(),
  success_url: z.string().url(),
  embed_origin: z.string().url().optional(),
});

export const PolarCustomerSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  created_at: z.string().datetime(),
});

export const PolarSubscriptionSchema = z.object({
  id: z.string(),
  customer_id: z.string(),
  product_id: z.string(),
  status: z.enum(['active', 'inactive', 'cancelled', 'past_due']),
  current_period_start: z.string().datetime().nullable(),
  current_period_end: z.string().datetime().nullable(),
  cancel_at_period_end: z.boolean(),
});

export const PolarWebhookEventSchema = z.object({
  type: z.enum([
    'subscription.created',
    'subscription.updated',
    'subscription.deleted',
    'order.paid',
    'order.refunded',
  ]),
  data: z.object({
    id: z.string(),
    type: z.string(),
    attributes: z.record(z.unknown()),
  }),
});

// Types
export type PolarCheckoutInput = z.infer<typeof PolarCheckoutSchema>;
export type PolarCustomer = z.infer<typeof PolarCustomerSchema>;
export type PolarSubscription = z.infer<typeof PolarSubscriptionSchema>;
export type PolarWebhookEvent = z.infer<typeof PolarWebhookEventSchema>;

// Tier configuration
export interface PolarTier {
  id: string;
  name: 'starter' | 'growth' | 'premium' | 'master';
  price: number;
  currency: string;
  mcuMonthly: number;
  mcuOverageRate: number;
  polarProductId?: string; // Will be populated after creating products in Polar
}

export const POLAR_TIERS: Record<string, PolarTier> = {
  starter: {
    id: 'starter',
    name: 'starter',
    price: 4900, // cents
    currency: 'USD',
    mcuMonthly: 500,
    mcuOverageRate: 0.10,
  },
  growth: {
    id: 'growth',
    name: 'growth',
    price: 14900,
    currency: 'USD',
    mcuMonthly: 2000,
    mcuOverageRate: 0.08,
  },
  premium: {
    id: 'premium',
    name: 'premium',
    price: 49900,
    currency: 'USD',
    mcuMonthly: 10000,
    mcuOverageRate: 0.06,
  },
  master: {
    id: 'master',
    name: 'master',
    price: 99900,
    currency: 'USD',
    mcuMonthly: 25000,
    mcuOverageRate: 0.05,
  },
};

// Error types
export class PolarError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number
  ) {
    super(message);
    this.name = 'PolarError';
  }
}

// Client class
export class PolarClient {
  private baseUrl: string;
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    const baseUrl = process.env.POLAR_API_URL || 'https://api.polar.sh';
    const apiKey = process.env.POLAR_API_KEY;
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

    if (!apiKey) {
      throw new PolarError('POLAR_API_KEY not configured', 'CONFIG_ERROR');
    }

    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret || '';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new PolarError(
        error.message || `Polar API error: ${response.statusText}`,
        error.code || 'API_ERROR',
        response.status
      );
    }

    return response.json();
  }

  /**
   * Create a checkout session for a product
   */
  async createCheckoutSession(
    productId: string,
    customerEmail: string,
    successUrl: string,
    embedOrigin?: string
  ): Promise<{ url: string }> {
    const data = {
      product_id: productId,
      customer_email: customerEmail,
      success_url: successUrl,
      embed_origin: embedOrigin,
    };

    const validated = PolarCheckoutSchema.safeParse(data);
    if (!validated.success) {
      throw new PolarError(
        'Invalid checkout data',
        'VALIDATION_ERROR'
      );
    }

    return this.request('/v1/checkouts', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
  }

  /**
   * Create a customer portal session
   */
  async createPortalSession(
    customerId: string,
    returnUrl?: string
  ): Promise<{ url: string }> {
    return this.request(`/v1/customer-portal-sessions`, {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customerId,
        return_url: returnUrl,
      }),
    });
  }

  /**
   * Get subscription by ID
   */
  async getSubscription(
    subscriptionId: string
  ): Promise<PolarSubscription> {
    return this.request(`/v1/subscriptions/${subscriptionId}`);
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(
    email: string
  ): Promise<PolarCustomer | null> {
    try {
      const response = await this.request<{
        items: PolarCustomer[];
      }>(`/v1/customers?email=${encodeURIComponent(email)}`);
      return response.items?.[0] || null;
    } catch (error) {
      if (error instanceof PolarError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string
  ): boolean {
    if (!this.webhookSecret) {
      console.warn('POLAR_WEBHOOK_SECRET not configured');
      return true; // Skip verification in dev
    }

    // HMAC verification logic
    // Polar sends signature as: t=TIMESTAMP,v1=HMAC
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
    const expectedSignature = parts.find(p => p.startsWith('v1='))?.slice(3);

    if (!timestamp || !expectedSignature) {
      return false;
    }

    // Check timestamp (5 minute window)
    const now = Math.floor(Date.now() / 1000);
    const eventTime = parseInt(timestamp, 10);
    if (Math.abs(now - eventTime) > 300) {
      return false;
    }

    // Verify HMAC
    const signedPayload = `${timestamp}.${payload}`;
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(signedPayload);
    const computedSignature = hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    );
  }
}

// Singleton instance
let polarClientInstance: PolarClient | null = null;

export function getPolarClient(): PolarClient {
  if (!polarClientInstance) {
    polarClientInstance = new PolarClient();
  }
  return polarClientInstance;
}

export default getPolarClient;
```

### lib/billing/mcu-pricing.ts

```typescript
/**
 * MCU Pricing Calculator
 *
 * Handles:
 * - MCU cost calculations for features
 * - Overage pricing
 * - Tier-based discounts
 */

import { POLAR_TIERS, PolarTier } from './polar-client';

export interface McuCostConfig {
  feature: string;
  baseCost: number;
  tier?: 'starter' | 'growth' | 'premium' | 'master';
}

// Feature cost definitions
export const MCU_COSTS: Record<string, number> = {
  // AI Proposal Generation
  'proposal:text:basic': 10,      // Basic text proposal
  'proposal:text:advanced': 25,   // Advanced with custom sections
  'proposal:text:enterprise': 50, // Enterprise with analytics

  // Video Generation (future)
  'video:short': 100,    // <30 seconds
  'video:medium': 250,   // 30-60 seconds
  'video:long': 500,     // 60+ seconds

  // Other features
  'template:custom': 50,  // Custom template creation
  'export:pdf': 5,        // PDF export
  'export:html': 2,       // HTML export
  'api:call': 1,          // Per API call
};

/**
 * Calculate MCU cost for a feature with tier discount
 */
export function calculateMcuCost(
  feature: string,
  tierName?: string
): number {
  const baseCost = MCU_COSTS[feature] || 0;

  if (!tierName) {
    return baseCost;
  }

  const tier = POLAR_TIERS[tierName];
  if (!tier) {
    return baseCost;
  }

  // Apply tier discount (higher tiers = lower costs)
  const discounts: Record<string, number> = {
    starter: 1.0,    // No discount
    growth: 0.9,     // 10% off
    premium: 0.8,    // 20% off
    master: 0.7,     // 30% off
  };

  const discount = discounts[tierName] || 1.0;
  return Math.floor(baseCost * discount);
}

/**
 * Calculate overage cost in USD
 */
export function calculateOverageCost(
  mcuUsed: number,
  tierName: string
): number {
  const tier = POLAR_TIERS[tierName];
  if (!tier) {
    return 0;
  }

  const overageMcu = Math.max(0, mcuUsed - tier.mcuMonthly);
  return overageMcu * tier.mcuOverageRate;
}

/**
 * Get tier by Polar product ID
 */
export function getTierByProductId(productId: string): PolarTier | null {
  return Object.values(POLAR_TIERS).find(
    tier => tier.polarProductId === productId
  ) || null;
}

/**
 * Get tier name from price
 */
export function getTierByPrice(price: number): string | null {
  const tier = Object.values(POLAR_TIERS).find(
    t => t.price === price
  );
  return tier?.name || null;
}
```

## Implementation Steps

1. Create `lib/billing/` directory
2. Create `polar-client.ts` with API wrapper
3. Create `mcu-pricing.ts` with cost calculations
4. Add Polar environment variables to `.env.local` and `.env.example`
5. Test client with Polar API (sandbox mode)

## Environment Variables

Add to `.env.example`:

```bash
# Polar.sh Billing (https://polar.sh)
POLAR_API_URL=https://api.polar.sh
POLAR_API_KEY=<YOUR_POLAR_API_KEY>
POLAR_WEBHOOK_SECRET=<YOUR_WEBHOOK_SECRET>
```

## Success Criteria

- [x] PolarClient class created with all methods
- [x] Type safety with Zod schemas
- [x] Webhook signature verification working
- [x] MCU pricing calculations correct
- [x] TypeScript compilation passes

**Completed:** 2026-03-20

## Related Files

- Client: `lib/billing/polar-client.ts`
- Pricing: `lib/billing/mcu-pricing.ts`
- Env: `.env.local`, `.env.example`
