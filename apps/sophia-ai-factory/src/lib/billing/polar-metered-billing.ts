/**
 * Polar.sh Metered Billing API Client
 *
 * Wrapper for Polar.sh API to support usage-based metered billing.
 * Provides usage tracking, customer meter updates, and invoice creation.
 *
 * Features:
 * - Rate limit handling with exponential backoff retries
 * - Idempotency key support for deduplication
 * - Type-safe API responses
 * - Integration with existing overage billing system
 *
 * @see https://docs.polar.sh/api-reference
 * @module billing/polar-metered-billing
 */

import { Polar } from '@polar-sh/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { Tier } from '@/types';
import { getPolarClient, polarHelpers } from '@/lib/clients/polar-client';

/**
 * Polar metered billing configuration
 */
export interface PolarMeteredConfig {
  /** Enable metered billing integration */
  enabled: boolean;
  /** Maximum retry attempts for rate-limited requests */
  maxRetries: number;
  /** Base delay for exponential backoff (ms) */
  baseDelayMs: number;
  /** Maximum delay cap (ms) */
  maxDelayMs: number;
}

/**
 * Default configuration
 */
export const DEFAULT_POLAR_METERED_CONFIG: PolarMeteredConfig = {
  enabled: true,
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Usage record input for Polar metered billing
 */
export interface PolarUsageRecordInput {
  /** Customer ID in Polar */
  customerId: string;
  /** Meter slug/identifier from Polar dashboard */
  meterSlug: string;
  /** Quantity to record */
  quantity: number;
  /** Unique idempotency key for deduplication */
  idempotencyKey: string;
  /** Optional timestamp (ISO 8601) */
  timestamp?: string;
  /** Optional metadata */
  metadata?: Record<string, string>;
}

/**
 * Result of recording usage
 */
export interface PolarUsageRecordResult {
  success: boolean;
  recordId?: string;
  customerId: string;
  meterSlug: string;
  quantity: number;
  message?: string;
  retryable?: boolean;
}

/**
 * Customer meter balance response
 */
export interface PolarCustomerMeterBalance {
  /** Meter slug */
  meterSlug: string;
  /** Current balance/usage */
  balance: number;
  /** Last updated timestamp */
  lastUpdated: string;
  /** Billing period start */
  periodStart?: string;
  /** Billing period end */
  periodEnd?: string;
}

/**
 * Polar invoice item for one-time charges
 */
export interface PolarInvoiceItemInput {
  /** Polar customer ID */
  customerId: string;
  /** Product ID for the charge */
  productId?: string;
  /** Amount in smallest currency unit (cents) */
  amount: number;
  /** Currency code (lowercase) */
  currency: string;
  /** Invoice item description */
  description: string;
  /** Metadata for tracking */
  metadata?: Record<string, string>;
  /** Idempotency key */
  idempotencyKey: string;
}

/**
 * Polar invoice item result
 */
export interface PolarInvoiceItemResult {
  success: boolean;
  invoiceItemId?: string;
  amount: number;
  currency: string;
  message?: string;
  retryable?: boolean;
}

/**
 * Rate limit error from Polar API
 */
export interface PolarRateLimitError {
  type: 'rate_limit';
  retryAfter: number;
  message: string;
}

/**
 * Check if error is rate limit
 */
function isRateLimitError(error: unknown): error is PolarRateLimitError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as PolarRateLimitError).type === 'rate_limit'
  );
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute API call with exponential backoff retry
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: PolarMeteredConfig,
  operation: string
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.baseDelayMs;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check for rate limit (429)
      const isRateLimit = error?.status === 429 || isRateLimitError(error);
      const retryAfter = error?.headers?.['retry-after']
        ? parseInt(error.headers['retry-after'], 10) * 1000
        : null;

      if (!isRateLimit || attempt === config.maxRetries) {
        throw error;
      }

      // Calculate delay with jitter
      const jitter = Math.random() * 0.3 * delay;
      const waitTime = retryAfter || Math.min(delay + jitter, config.maxDelayMs);

      logger.warn('[Polar Metered] Rate limited, retrying', {
        operation,
        attempt,
        maxRetries: config.maxRetries,
        delayMs: waitTime,
        retryAfter: retryAfter ? retryAfter / 1000 : undefined,
      });

      await sleep(waitTime);
      delay = Math.min(delay * 2, config.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Generate idempotency key for usage record
 */
export function generatePolarIdempotencyKey(
  customerId: string,
  meterSlug: string,
  timestamp: number,
  sequence?: number
): string {
  const seq = sequence || 0;
  return `polar_usage_${customerId}_${meterSlug}_${timestamp}_${seq}`;
}

/**
 * Record usage for Polar metered billing
 *
 * @param input - Usage record input
 * @param config - Metered billing configuration
 * @returns Result of usage recording
 *
 * @example
 * const result = await recordPolarUsage({
 *   customerId: 'cust_123',
 *   meterSlug: 'api_credits',
 *   quantity: 100,
 *   idempotencyKey: 'usage_user123_1234567890'
 * });
 */
export async function recordPolarUsage(
  input: PolarUsageRecordInput,
  config: PolarMeteredConfig = DEFAULT_POLAR_METERED_CONFIG
): Promise<PolarUsageRecordResult> {
  if (!config.enabled) {
    logger.debug('[Polar Metered] Disabled, skipping usage record');
    return {
      success: false,
      customerId: input.customerId,
      meterSlug: input.meterSlug,
      quantity: input.quantity,
      message: 'Polar metered billing disabled',
    };
  }

  try {
    const polar = getPolarClient();

    // Record usage via Customer Meter API
    const result = await withRetry(
      async () => {
        // Polar.sh API: POST /customer-meters/{id}/usage
        const response = await polar.customerMeters.createUsage({
          customerId: input.customerId,
          body: {
            meter_slug: input.meterSlug,
            quantity: input.quantity,
            idempotency_key: input.idempotencyKey,
            timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
            metadata: input.metadata,
          },
        });

        return response;
      },
      config,
      'recordUsage'
    );

    logger.info('[Polar Metered] Usage recorded', {
      customerId: input.customerId,
      meterSlug: input.meterSlug,
      quantity: input.quantity,
      idempotencyKey: input.idempotencyKey.slice(0, 16),
    });

    return {
      success: true,
      recordId: input.idempotencyKey,
      customerId: input.customerId,
      meterSlug: input.meterSlug,
      quantity: input.quantity,
      message: `Recorded ${input.quantity} units for meter ${input.meterSlug}`,
    };
  } catch (error) {
    logger.error('[Polar Metered] Failed to record usage', error as Error, {
      customerId: input.customerId,
      meterSlug: input.meterSlug,
      quantity: input.quantity,
    });

    return {
      success: false,
      customerId: input.customerId,
      meterSlug: input.meterSlug,
      quantity: input.quantity,
      message: (error as Error)?.message || 'Unknown error',
      retryable: (error as { status?: number })?.status === 429 || (error as { status?: number })?.status >= 500,
    };
  }
}

/**
 * Get customer meter balance
 *
 * @param customerId - Polar customer ID
 * @param meterSlug - Meter slug to query
 * @returns Current meter balance
 */
export async function getPolarCustomerMeterBalance(
  customerId: string,
  meterSlug: string
): Promise<PolarCustomerMeterBalance | null> {
  try {
    const polar = getPolarClient();

    // Fetch customer meter balances
    const balances = await polar.customerMeters.listBalances({
      customerId,
    });

    // Find matching meter
    const meterBalance = balances.items.find(
      (balance) => balance.meter_slug === meterSlug
    );

    if (!meterBalance) {
      logger.warn('[Polar Metered] Meter not found for customer', {
        customerId,
        meterSlug,
      });
      return null;
    }

    return {
      meterSlug: meterBalance.meter_slug,
      balance: meterBalance.balance,
      lastUpdated: meterBalance.last_updated.toISOString(),
      periodStart: meterBalance.period_start?.toISOString(),
      periodEnd: meterBalance.period_end?.toISOString(),
    };
  } catch (error) {
    logger.error('[Polar Metered] Failed to get meter balance', error as Error, {
      customerId,
      meterSlug,
    });
    return null;
  }
}

/**
 * Create Polar invoice item for one-time charge
 *
 * @param input - Invoice item input
 * @param config - Metered billing configuration
 * @returns Result of invoice item creation
 *
 * @example
 * const result = await createPolarInvoiceItem({
 *   customerId: 'cust_123',
 *   amount: 1000, // $10.00
 *   currency: 'usd',
 *   description: 'Overage charges',
 *   idempotencyKey: 'overage_user123_period1'
 * });
 */
export async function createPolarInvoiceItem(
  input: PolarInvoiceItemInput,
  config: PolarMeteredConfig = DEFAULT_POLAR_METERED_CONFIG
): Promise<PolarInvoiceItemResult> {
  if (!config.enabled) {
    logger.debug('[Polar Metered] Disabled, skipping invoice item');
    return {
      success: false,
      amount: input.amount,
      currency: input.currency,
      message: 'Polar metered billing disabled',
    };
  }

  try {
    const polar = getPolarClient();

    // Create order/product for one-time charge
    // Note: Polar uses Orders for one-time charges
    const result = await withRetry(
      async () => {
        // For one-time charges, we create an order directly
        const order = await polar.orders.create({
          customerId: input.customerId,
          productId: input.productId,
          amount: input.amount,
          currency: input.currency as 'usd' | 'eur',
          metadata: {
            ...input.metadata,
            description: input.description,
            idempotency_key: input.idempotencyKey,
          },
        });

        return order;
      },
      config,
      'createInvoiceItem'
    );

    logger.info('[Polar Metered] Invoice item created', {
      orderId: result.id,
      customerId: input.customerId,
      amount: input.amount,
      currency: input.currency,
    });

    return {
      success: true,
      invoiceItemId: result.id,
      amount: input.amount,
      currency: input.currency,
      message: `Created order ${result.id} for $${(input.amount / 100).toFixed(2)}`,
    };
  } catch (error) {
    logger.error('[Polar Metered] Failed to create invoice item', error as Error, {
      customerId: input.customerId,
      amount: input.amount,
      description: input.description,
    });

    return {
      success: false,
      amount: input.amount,
      currency: input.currency,
      message: (error as Error)?.message || 'Unknown error',
      retryable: (error as { status?: number })?.status === 429 || (error as { status?: number })?.status >= 500,
    };
  }
}

/**
 * Map overage event to Polar usage record
 */
export function mapOverageToPolarUsage(
  userId: string,
  polarCustomerId: string,
  exceededBy: number,
  exceededType: string,
  licenseNonce: string
): PolarUsageRecordInput {
  const timestamp = Math.floor(Date.now() / 1000);
  const meterSlug = exceededType.includes('requests')
    ? 'api_requests'
    : 'api_credits';

  return {
    customerId: polarCustomerId,
    meterSlug,
    quantity: exceededBy,
    idempotencyKey: generatePolarIdempotencyKey(
      userId,
      meterSlug,
      timestamp
    ),
    metadata: {
      license_nonce: licenseNonce,
      exceeded_type: exceededType,
    },
  };
}

/**
 * Validate Polar metered billing configuration
 */
export function validatePolarMeteredConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check access token
  if (!process.env.POLAR_ACCESS_TOKEN) {
    errors.push('POLAR_ACCESS_TOKEN environment variable not set');
  }

  // Check organization ID
  if (!process.env.POLAR_ORGANIZATION_ID) {
    warnings.push('POLAR_ORGANIZATION_ID not set - required for some operations');
  }

  // Check meter slugs configuration
  const requiredMeters = ['api_credits', 'api_requests'];
  const configuredMeters = process.env.POLAR_METER_SLUGS?.split(',') || [];

  for (const meter of requiredMeters) {
    if (!configuredMeters.includes(meter)) {
      warnings.push(`Meter slug "${meter}" not in POLAR_METER_SLUGS`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Polar subscription status check result
 */
export interface PolarSubscriptionStatus {
  active: boolean;
  balance: number;
  currentPeriodEnd: string | null;
  subscriptionTier: string;
}

/**
 * Check Polar subscription status and balance
 *
 * @param polarCustomerId - Polar customer ID
 * @returns Subscription status with balance and period info
 */
export async function checkPolarSubscriptionStatus(
  polarCustomerId: string
): Promise<PolarSubscriptionStatus> {
  const polarApiKey = process.env.POLAR_API_KEY;

  if (!polarApiKey) {
    logger.warn('[Polar Metered] POLAR_API_KEY not set, returning inactive status');
    return {
      active: false,
      balance: 0,
      currentPeriodEnd: null,
      subscriptionTier: 'inactive',
    };
  }

  try {
    // Fetch customer subscription info from Polar
    const response = await fetch(
      `https://api.polar.sh/v1/customers/${polarCustomerId}/subscriptions`,
      {
        headers: {
          'Authorization': `Bearer ${polarApiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Customer has no subscriptions
        return {
          active: false,
          balance: 0,
          currentPeriodEnd: null,
          subscriptionTier: 'none',
        };
      }
      throw new Error(`Polar API returned ${response.status}`);
    }

    const data = await response.json() as {
      items: Array<{
        id: string;
        status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'expired';
        current_period_end: string | null;
        product: {
          name: string;
          description?: string;
        };
      }>
    };

    // Find active subscription
    const activeSubscription = data.items.find(
      (sub) => sub.status === 'active'
    );

    if (!activeSubscription) {
      // No active subscription
      return {
        active: false,
        balance: 0,
        currentPeriodEnd: null,
        subscriptionTier: data.items.length > 0 ? 'expired' : 'none',
      };
    }

    // Get meter balance for active subscription
    let balance = 0;
    try {
      const balancesResponse = await fetch(
        `https://api.polar.sh/v1/customers/${polarCustomerId}/balances`,
        {
          headers: {
            'Authorization': `Bearer ${polarApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (balancesResponse.ok) {
        const balancesData = await balancesResponse.json() as {
          items: Array<{
            meter_slug: string;
            balance: number;
          }>
        };

        // Sum all meter balances
        balance = balancesData.items.reduce(
          (sum, meter) => sum + meter.balance,
          0
        );
      }
    } catch (balanceError) {
      logger.warn('[Polar Metered] Failed to fetch balance', balanceError instanceof Error ? balanceError : new Error(String(balanceError)));
      // Continue with balance = 0
    }

    return {
      active: true,
      balance,
      currentPeriodEnd: activeSubscription.current_period_end,
      subscriptionTier: activeSubscription.product.name,
    };
  } catch (error) {
    logger.error('[Polar Metered] Failed to check subscription status', error instanceof Error ? error : new Error(String(error)));
    return {
      active: false,
      balance: 0,
      currentPeriodEnd: null,
      subscriptionTier: 'error',
    };
  }
}

/**
 * Initialize Polar metered billing
 */
export function initPolarMeteredBilling(): boolean {
  const validation = validatePolarMeteredConfig();

  if (!validation.valid) {
    logger.error('[Polar Metered] Invalid configuration', {
      errors: validation.errors,
    });
    return false;
  }

  if (validation.warnings.length > 0) {
    logger.warn('[Polar Metered] Configuration warnings', {
      warnings: validation.warnings,
    });
  }

  logger.info('[Polar Metered] Initialized successfully', {
    warnings: validation.warnings.length,
  });

  return true;
}
