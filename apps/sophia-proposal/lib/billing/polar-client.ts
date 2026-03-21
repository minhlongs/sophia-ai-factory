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
      // CRITICAL: Never skip verification in production
      if (process.env.NODE_ENV === 'production') {
        throw new PolarError(
          'POLAR_WEBHOOK_SECRET is required in production',
          'CONFIG_ERROR'
        );
      }
      console.warn('POLAR_WEBHOOK_SECRET not configured - allowing in dev only');
      return true;
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
