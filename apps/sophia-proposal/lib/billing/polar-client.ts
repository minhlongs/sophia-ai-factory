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
    polarProductId: process.env.POLAR_PRODUCT_STARTER,
  },
  growth: {
    id: 'growth',
    name: 'growth',
    price: 14900,
    currency: 'USD',
    mcuMonthly: 2000,
    mcuOverageRate: 0.08,
    polarProductId: process.env.POLAR_PRODUCT_GROWTH,
  },
  premium: {
    id: 'premium',
    name: 'premium',
    price: 49900,
    currency: 'USD',
    mcuMonthly: 10000,
    mcuOverageRate: 0.06,
    polarProductId: process.env.POLAR_PRODUCT_PREMIUM,
  },
  master: {
    id: 'master',
    name: 'master',
    price: 99900,
    currency: 'USD',
    mcuMonthly: 25000,
    mcuOverageRate: 0.05,
    polarProductId: process.env.POLAR_PRODUCT_MASTER,
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
  private apiKey: string | null;
  private webhookSecret: string;

  constructor() {
    this.baseUrl = process.env.POLAR_API_URL || 'https://api.polar.sh';
    this.apiKey = process.env.POLAR_ACCESS_TOKEN ?? process.env.POLAR_API_KEY ?? null;
    this.webhookSecret = process.env.POLAR_WEBHOOK_SECRET || '';
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new PolarError('Billing not configured: POLAR_ACCESS_TOKEN is missing', 'CONFIG_ERROR');
    }
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
   * Verify webhook signature.
   * Returns null when POLAR_WEBHOOK_SECRET is not set — callers should
   * accept-but-skip-processing to prevent Polar retry storms.
   */
  async verifyWebhookSignature(
    payload: string,
    signature: string
  ): Promise<boolean | null> {
    if (!this.webhookSecret) {
      // Signal "not configured" — webhook handler will accept silently
      return null;
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

    // Verify HMAC using Web Crypto (CF Workers compatible)
    const signedPayload = `${timestamp}.${payload}`;
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw', enc.encode(this.webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sigBuf = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
    const computedSignature = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Constant-time comparison
    if (computedSignature.length !== expectedSignature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < computedSignature.length; i++) {
      mismatch |= computedSignature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return mismatch === 0;
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
