/**
 * Stripe Metered Billing Integration
 *
 * Push usage metrics to Stripe Billing for overage charges
 * - Record usage for metered billing
 * - Map tiers to Stripe price IDs
 * - Sync overage events to Stripe metered line items
 *
 * @module payments/stripe-metered-billing
 */

import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { Tier } from '@/types';

/**
 * Stripe metered billing configuration
 */
interface StripeMeteredConfig {
  apiKey: string;
  webhookSecret?: string;
}

/**
 * Usage record for Stripe metered billing
 */
export interface UsageRecordInput {
  /** Subscription item ID (metered price) */
  subscriptionItemId: string;
  /** Quantity to record */
  quantity: number;
  /** Action type: 'set' (default), 'increment', 'max' */
  action?: 'set' | 'increment' | 'max';
  /** Idempotency key for deduplication */
  idempotencyKey: string;
  /** Optional timestamp for the usage (Unix seconds) */
  timestamp?: number;
}

/**
 * Overage event for syncing to Stripe
 */
export interface OverageSyncInput {
  userId: string;
  licenseNonce: string;
  /** Type of overage: hourly, daily, monthly credits or requests */
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  /** Number of credits/units over the limit */
  exceededBy: number;
  /** Tier at time of overage */
  tier: Tier;
  /** External customer ID (Stripe customer ID) */
  externalCustomerId?: string;
  /** Stripe subscription ID */
  stripeSubscriptionId?: string;
}

/**
 * Result of usage recording
 */
export interface UsageRecordResult {
  success: boolean;
  recordId?: string;
  subscriptionItemId: string;
  quantity: number;
  message?: string;
}

/**
 * Stripe metered billing price mapping per tier
 * Maps internal Tier to Stripe Price ID for metered billing
 */
const METERED_PRICE_IDS: Record<Tier, {
  credits: string;  // Price ID for credit overages
  requests?: string; // Price ID for request overages (optional)
}> = {
  BASIC: {
    credits: 'price_basic_credits', // Replace with actual Stripe Price ID
    requests: 'price_basic_requests',
  },
  PREMIUM: {
    credits: 'price_premium_credits',
    requests: 'price_premium_requests',
  },
  ENTERPRISE: {
    credits: 'price_enterprise_credits',
    requests: 'price_enterprise_requests',
  },
  MASTER: {
    credits: 'price_master_credits',
    requests: 'price_master_requests',
  },
};

/**
 * Singleton Stripe instance
 */
let stripeInstance: Stripe | null = null;

/**
 * Get or create Stripe instance
 */
function getStripe(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable not set');
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: '2024-06-20', // Use latest stable API version
      typescript: true,
    });
  }
  return stripeInstance;
}

/**
 * Get metered billing price ID for a given tier
 *
 * @param tier - User's subscription tier
 * @param type - 'credits' or 'requests'
 * @returns Stripe Price ID for metered billing
 *
 * @example
 * const priceId = getMeteredBillingPriceId('PREMIUM', 'credits');
 */
export function getMeteredBillingPriceId(
  tier: Tier,
  type: 'credits' | 'requests' = 'credits'
): string {
  const priceMapping = METERED_PRICE_IDS[tier];
  if (!priceMapping) {
    logger.warn('[Stripe Metered] Unknown tier, defaulting to PREMIUM', { tier });
    return METERED_PRICE_IDS.PREMIUM[type];
  }

  const priceId = priceMapping[type];
  if (!priceId) {
    throw new Error(`Price ID not configured for tier ${tier}, type ${type}`);
  }

  return priceId;
}

/**
 * Generate idempotency key for usage record
 * Prevents duplicate charges for same usage event
 */
function generateIdempotencyKey(
  userId: string,
  subscriptionItemId: string,
  timestamp: number,
  sequence?: number
): string {
  const seq = sequence || 0;
  return `usage_${userId}_${subscriptionItemId}_${timestamp}_${seq}`;
}

/**
 * Record usage for Stripe metered billing
 *
 * @param input - Usage record input
 * @returns Result of usage recording
 *
 * @example
 * const result = await recordUsageForBilling({
 *   subscriptionItemId: 'si_123',
 *   quantity: 100,
 *   action: 'increment',
 *   idempotencyKey: 'usage_user123_si123_1234567890'
 * });
 */
export async function recordUsageForBilling(
  input: UsageRecordInput
): Promise<UsageRecordResult> {
  const stripe = getStripe();

  try {
    // Create usage record with idempotency
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      input.subscriptionItemId,
      {
        quantity: input.quantity,
        action: input.action || 'set',
        timestamp: input.timestamp || Math.floor(Date.now() / 1000),
      },
      {
        idempotencyKey: input.idempotencyKey,
      }
    );

    logger.info('[Stripe Metered] Usage recorded', {
      recordId: usageRecord.id,
      subscriptionItemId: input.subscriptionItemId,
      quantity: input.quantity,
      action: input.action,
    });

    return {
      success: true,
      recordId: usageRecord.id,
      subscriptionItemId: input.subscriptionItemId,
      quantity: input.quantity,
      message: `Recorded ${input.quantity} units for subscription item ${input.subscriptionItemId}`,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Stripe Metered] Failed to record usage', err, {
      subscriptionItemId: input.subscriptionItemId,
      quantity: input.quantity,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      success: false,
      subscriptionItemId: input.subscriptionItemId,
      quantity: input.quantity,
      message: err.message,
    };
  }
}

/**
 * Batch record usage for efficiency
 * Records multiple usage events in parallel with rate limiting
 */
export interface BatchUsageRecordInput {
  userId: string;
  subscriptionItemId: string;
  quantity: number;
  action?: 'set' | 'increment' | 'max';
  timestamp?: number;
}

/**
 * Batch result for usage recording
 */
export interface BatchUsageRecordResult {
  totalAttempted: number;
  totalSuccessful: number;
  totalFailed: number;
  results: UsageRecordResult[];
}

/**
 * Record batch usage for Stripe metered billing
 *
 * @param records - Array of usage records to record
 * @param options - Batch options
 * @returns Batch result
 *
 * @example
 * const result = await recordBatchUsageForBilling([
 *   { userId: 'user1', subscriptionItemId: 'si_123', quantity: 100 },
 *   { userId: 'user2', subscriptionItemId: 'si_456', quantity: 50 },
 * ]);
 */
export async function recordBatchUsageForBilling(
  records: BatchUsageRecordInput[],
  options: { concurrencyLimit?: number } = {}
): Promise<BatchUsageRecordResult> {
  const concurrencyLimit = options.concurrencyLimit || 5;
  const results: UsageRecordResult[] = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < records.length; i += concurrencyLimit) {
    const batch = records.slice(i, i + concurrencyLimit);

    const batchResults = await Promise.all(
      batch.map(async (record) => {
        const timestamp = record.timestamp || Math.floor(Date.now() / 1000);
        const idempotencyKey = generateIdempotencyKey(
          record.userId,
          record.subscriptionItemId,
          timestamp
        );

        return recordUsageForBilling({
          subscriptionItemId: record.subscriptionItemId,
          quantity: record.quantity,
          action: record.action,
          idempotencyKey,
          timestamp,
        });
      })
    );

    results.push(...batchResults);

    // Rate limiting delay between batches
    if (i + concurrencyLimit < records.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  logger.info('[Stripe Metered] Batch usage recorded', {
    totalAttempted: records.length,
    totalSuccessful: successful,
    totalFailed: failed,
  });

  return {
    totalAttempted: records.length,
    totalSuccessful: successful,
    totalFailed: failed,
    results,
  };
}

/**
 * Get subscription item ID for a user's metered price
 * Looks up the active subscription and finds the metered price item
 */
export async function getMeteredSubscriptionItemId(
  userId: string,
  priceType: 'credits' | 'requests' = 'credits'
): Promise<string | null> {
  const supabase = createAdminClient();

  try {
    // Get user's Stripe customer and subscription IDs
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id, stripe_subscription_id, subscription_tier')
      .eq('user_id', userId)
      .single();

    if (userError || !userProfile) {
      logger.warn('[Stripe Metered] User profile not found', { userId });
      return null;
    }

    const { stripe_subscription_id, subscription_tier } = userProfile as {
      stripe_subscription_id: string | null;
      subscription_tier: string;
    };

    if (!stripe_subscription_id) {
      logger.warn('[Stripe Metered] No Stripe subscription for user', { userId });
      return null;
    }

    // Get subscription items from Stripe
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(stripe_subscription_id, {
      expand: ['items.data.price'],
    });

    // Find metered price item for this tier and type
    const tier = subscription_tier.toUpperCase() as Tier;
    const targetPriceId = getMeteredBillingPriceId(tier, priceType);

    const meteredItem = subscription.items.data.find(item => {
      const price = item.price as Stripe.Price;
      return price.id === targetPriceId || price.metadata?.tier === tier;
    });

    if (!meteredItem) {
      logger.warn('[Stripe Metered] No metered price item found', {
        userId,
        tier,
        priceType,
      });
      return null;
    }

    return meteredItem.id;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Stripe Metered] Failed to get metered subscription item', err, { userId });
    return null;
  }
}

/**
 * Sync overage event to Stripe
 * Creates usage record for overage credits
 */
export async function syncOverageToStripe(
  input: OverageSyncInput
): Promise<UsageRecordResult | null> {
  const {
    userId,
    licenseNonce,
    exceededType,
    exceededBy,
    tier,
    externalCustomerId,
    stripeSubscriptionId,
  } = input;

  try {
    // Determine price type based on overage type
    const priceType: 'credits' | 'requests' =
      exceededType.includes('requests') ? 'requests' : 'credits';

    // Get subscription item ID
    let subscriptionItemId: string | null = null;

    if (stripeSubscriptionId && externalCustomerId) {
      // If we have subscription ID, look up the metered item
      subscriptionItemId = await getMeteredSubscriptionItemId(userId, priceType);
    }

    if (!subscriptionItemId) {
      logger.warn('[Stripe Metered] Cannot sync overage - no subscription item', {
        userId,
        tier,
        exceededType,
      });
      return null;
    }

    // Record usage for the overage amount
    const timestamp = Math.floor(Date.now() / 1000);
    const idempotencyKey = generateIdempotencyKey(
      `overage_${licenseNonce}`,
      subscriptionItemId,
      timestamp
    );

    const result = await recordUsageForBilling({
      subscriptionItemId,
      quantity: exceededBy,
      action: 'increment',
      idempotencyKey,
      timestamp,
    });

    // Mark overage event as synced to Stripe
    if (result.success) {
      const supabase = createAdminClient();
      await supabase
        .from('overage_events')
        .update({
          synced_to_stripe: true,
          stripe_usage_record_id: result.recordId,
          synced_at: new Date().toISOString(),
        } as any)
        .eq('license_nonce', licenseNonce)
        .eq('exceeded_type', exceededType);

      logger.info('[Stripe Metered] Overage synced to Stripe', {
        userId,
        licenseNonce: licenseNonce.slice(0, 8) + '...',
        exceededBy,
        subscriptionItemId,
      });
    }

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Stripe Metered] Failed to sync overage', err, {
      userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      exceededBy,
    });
    return null;
  }
}

/**
 * Sync batch overage events to Stripe
 * Efficiently syncs multiple overage events
 */
export async function syncBatchOverageToStripe(
  overageEvents: Array<{
    userId: string;
    licenseNonce: string;
    exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
    exceededBy: number;
    tier: Tier;
    externalCustomerId?: string;
    stripeSubscriptionId?: string;
  }>,
  options: { concurrencyLimit?: number } = {}
): Promise<{
  totalAttempted: number;
  totalSuccessful: number;
  totalFailed: number;
  results: Array<UsageRecordResult | null>;
}> {
  const concurrencyLimit = options.concurrencyLimit || 3;
  const results: Array<UsageRecordResult | null> = [];

  for (let i = 0; i < overageEvents.length; i += concurrencyLimit) {
    const batch = overageEvents.slice(i, i + concurrencyLimit);

    const batchResults = await Promise.all(
      batch.map(event => syncOverageToStripe(event))
    );

    results.push(...batchResults);

    // Rate limiting delay
    if (i + concurrencyLimit < overageEvents.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  const successful = results.filter(r => r?.success).length;
  const failed = results.filter(r => r === null || !r.success).length;

  logger.info('[Stripe Metered] Batch overage sync completed', {
    totalAttempted: overageEvents.length,
    totalSuccessful: successful,
    totalFailed: failed,
  });

  return {
    totalAttempted: overageEvents.length,
    totalSuccessful: successful,
    totalFailed: failed,
    results,
  };
}

/**
 * Get usage summary for billing period
 * Retrieves all usage records for a subscription item within a date range
 */
export async function getUsageSummary(
  subscriptionItemId: string,
  periodStart: number,
  periodEnd: number
): Promise<{
  totalUsage: number;
  recordCount: number;
  records: Array<{
    id: string;
    quantity: number;
    timestamp: number;
  }>;
}> {
  const stripe = getStripe();

  try {
    const usageRecords = await stripe.subscriptionItems.listUsageRecordSummaries(
      subscriptionItemId,
      {
        period: {
          start: periodStart,
          end: periodEnd,
        },
      }
    );

    const summary = usageRecords.data[0];
    if (!summary) {
      return {
        totalUsage: 0,
        recordCount: 0,
        records: [],
      };
    }

    const totalUsage = summary.total_usage || 0;
    const records = (summary.usage_records || []).map(record => ({
      id: record.id,
      quantity: record.quantity,
      timestamp: record.timestamp,
    }));

    return {
      totalUsage,
      recordCount: records.length,
      records,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[Stripe Metered] Failed to get usage summary', err, {
      subscriptionItemId,
      periodStart,
      periodEnd,
    });
    return {
      totalUsage: 0,
      recordCount: 0,
      records: [],
    };
  }
}

/**
 * Validate Stripe configuration
 * Checks if Stripe API key and price IDs are properly configured
 */
export function validateStripeMeteredConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check API key
  if (!process.env.STRIPE_SECRET_KEY) {
    errors.push('STRIPE_SECRET_KEY environment variable not set');
  } else if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
    errors.push('STRIPE_SECRET_KEY does not start with sk_');
  }

  // Check price IDs configuration
  const validTiers: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
  for (const tier of validTiers) {
    const config = METERED_PRICE_IDS[tier];
    if (!config) {
      errors.push(`No price configuration for tier: ${tier}`);
      continue;
    }

    // Check if price IDs are placeholders
    if (config.credits.startsWith('price_')) {
      warnings.push(`Credits price ID for ${tier} may be a placeholder: ${config.credits}`);
    }

    if (config.requests?.startsWith('price_')) {
      warnings.push(`Requests price ID for ${tier} may be a placeholder: ${config.requests}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Initialize Stripe metered billing
 * Validates configuration and logs status
 */
export function initStripeMeteredBilling(): boolean {
  const validation = validateStripeMeteredConfig();

  if (!validation.valid) {
    logger.error('[Stripe Metered] Invalid configuration', {
      errors: validation.errors,
    });
    return false;
  }

  if (validation.warnings.length > 0) {
    logger.warn('[Stripe Metered] Configuration warnings', {
      warnings: validation.warnings,
    });
  }

  logger.info('[Stripe Metered] Initialized successfully', {
    warnings: validation.warnings.length,
  });

  return true;
}
