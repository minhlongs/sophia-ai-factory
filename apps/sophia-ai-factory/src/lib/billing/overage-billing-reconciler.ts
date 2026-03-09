/**
 * Overage Billing Reconciler
 *
 * Scans unbilled overage events, calculates charges based on tier pricing,
 * creates Stripe/Polar invoice items, and marks events as billed.
 *
 * Features:
 * - Idempotency: Prevents double-billing same events
 * - Retry logic: Handles transient failures
 * - Tier-based pricing: BASIC $0.10, PREMIUM $0.05, ENTERPRISE $0.03, MASTER $0.02
 * - Integration with stripe-metered-billing.ts
 * - Integration with polar-metered-billing.ts
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { OverageEvent, OverageEventRow } from './billing-types';
import {
  PRICING_TIERS,
  mapOverageEventRow,
  generateIdempotencyKey,
  type OverageCharge,
  type StripeInvoiceItem,
  type ReconciliationResult,
  type ReconciliationError,
  type UnbilledEventsByUser,
  type OverageBillingConfig,
  type PolarBillingConfig,
  DEFAULT_OVERAGE_BILLING_CONFIG,
  DEFAULT_POLAR_BILLING_CONFIG,
} from './billing-types';
import {
  createPolarInvoiceItem,
  type PolarInvoiceItemInput,
  type PolarInvoiceItemResult,
  type PolarMeteredConfig,
  DEFAULT_POLAR_METERED_CONFIG,
} from './polar-metered-billing';
import type Stripe from 'stripe';

/**
 * Stripe client lazy initialization
 */
let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    // Dynamic import to avoid bundling Stripe in edge runtime
    const Stripe = require('stripe').default;
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    });
  }
  return stripeClient;
}

/**
 * Scan unbilled overage events from database
 *
 * @param config - Billing configuration
 * @returns Array of unbilled overage events grouped by user
 */
export async function scanUnbilledOverageEvents(
  config: OverageBillingConfig = DEFAULT_OVERAGE_BILLING_CONFIG
): Promise<UnbilledEventsByUser[]> {
  const supabase = createAdminClient();

  try {
    // Fetch unbilled overage events
    const { data: rows, error } = await supabase
      .from('overage_events')
      .select('*')
      .eq('billable', false)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Database error scanning overage events: ${error.message}`);
    }

    if (!rows || rows.length === 0) {
      logger.info('[Overage Reconciler] No unbilled overage events found');
      return [];
    }

    // Map rows to events
    const events: OverageEvent[] = rows.map((row: OverageEventRow) =>
      mapOverageEventRow(row)
    );

    // Group by user + license
    const grouped = new Map<string, UnbilledEventsByUser>();

    for (const event of events) {
      const key = `${event.userId}:${event.licenseNonce}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          userId: event.userId,
          licenseNonce: event.licenseNonce,
          tier: event.tierAtExceeded,
          externalCustomerId: event.externalCustomerId,
          events: [],
          totalOverageCredits: 0,
          periodStart: event.createdAt,
          periodEnd: event.createdAt,
        });
      }

      const group = grouped.get(key)!;
      group.events.push(event);
      group.totalOverageCredits += event.exceededBy;
      group.periodStart = Math.min(group.periodStart, event.createdAt);
      group.periodEnd = Math.max(group.periodEnd, event.createdAt);
    }

    const result = Array.from(grouped.values());

    logger.info('[Overage Reconciler] Scanned unbilled events', {
      totalEvents: events.length,
      uniqueUsers: result.length,
    });

    return result;
  } catch (error) {
    const err = error as Error;
    logger.error('[Overage Reconciler] Failed to scan unbilled events', err);
    throw error;
  }
}

/**
 * Calculate overage charges for a user's unbilled events
 *
 * @param userEvents - Unbilled events grouped by user
 * @returns Overage charge with total amount
 */
export function calculateOverageCharges(
  userEvents: UnbilledEventsByUser
): OverageCharge {
  const { tier, totalOverageCredits, licenseNonce, userId, periodStart, periodEnd } = userEvents;

  // Get pricing for tier
  const pricing = PRICING_TIERS[tier];

  if (!pricing) {
    logger.warn('[Overage Reconciler] Unknown tier', { tier });
    throw new Error(`Unknown tier: ${tier}`);
  }

  // Calculate total charge
  const totalCharge = totalOverageCredits * pricing.pricePerCredit;

  const charge: OverageCharge = {
    userId,
    licenseNonce,
    tier,
    overageCredits: totalOverageCredits,
    pricePerCredit: pricing.pricePerCredit,
    totalCharge,
    currency: pricing.currency,
    eventCount: userEvents.events.length,
    periodStart,
    periodEnd,
    externalCustomerId: userEvents.externalCustomerId,
  };

  logger.info('[Overage Reconciler] Calculated overage charge', {
    userId,
    licenseNonce: licenseNonce.slice(0, 8),
    tier,
    overageCredits: totalOverageCredits,
    pricePerCredit: pricing.pricePerCredit,
    totalCharge,
    currency: pricing.currency,
  });

  return charge;
}

/**
 * Create Stripe invoice item for overage charge
 *
 * @param charge - Overage charge to bill
 * @param config - Billing configuration
 * @returns Stripe invoice item ID
 */
export async function createStripeInvoiceItem(
  charge: OverageCharge,
  config: OverageBillingConfig = DEFAULT_OVERAGE_BILLING_CONFIG
): Promise<string> {
  const stripe = getStripeClient();

  if (!stripe) {
    throw new Error('Stripe client not initialized - missing STRIPE_SECRET_KEY');
  }

  // Check if customer exists
  if (!charge.externalCustomerId) {
    logger.warn('[Overage Reconciler] No customer ID for charge', {
      userId: charge.userId,
      licenseNonce: charge.licenseNonce,
    });
    throw new Error('No external customer ID for overage billing');
  }

  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(
    charge.licenseNonce,
    charge.periodStart,
    charge.periodEnd
  );

  try {
    // Create invoice item
    const invoiceItem = await stripe.invoiceItems.create(
      {
        customer: charge.externalCustomerId,
        price_data: {
          currency: charge.currency.toLowerCase(),
          product_data: {
            name: `Overage Usage - ${charge.tier} Tier`,
            description: `Overage credits: ${charge.overageCredits} @ $${charge.pricePerCredit}/credit`,
            metadata: {
              license_nonce: charge.licenseNonce,
              tier: charge.tier,
              period_start: new Date(charge.periodStart * 1000).toISOString(),
              period_end: new Date(charge.periodEnd * 1000).toISOString(),
            },
          },
          unit_amount: Math.round(charge.pricePerCredit * 100), // Convert to cents
        },
        quantity: charge.overageCredits,
        metadata: {
          license_nonce: charge.licenseNonce,
          overage_credits: charge.overageCredits.toString(),
          period_start: new Date(charge.periodStart * 1000).toISOString(),
          period_end: new Date(charge.periodEnd * 1000).toISOString(),
          event_count: charge.eventCount.toString(),
        },
      },
      {
        idempotencyKey,
      }
    );

    logger.info('[Overage Reconciler] Created Stripe invoice item', {
      invoiceItemId: invoiceItem.id,
      userId: charge.userId,
      licenseNonce: charge.licenseNonce.slice(0, 8),
      amount: charge.totalCharge,
      currency: charge.currency,
    });

    return invoiceItem.id;
  } catch (error) {
    const stripeError = error as Stripe.errors.StripeError;
    // Handle idempotency conflict (already created)
    if (stripeError.code === 'idempotency_error') {
      logger.info('[Overage Reconciler] Invoice item already exists (idempotency)', {
        idempotencyKey,
      });
      // Try to find existing invoice item
      const existingItems = await stripe.invoiceItems.list({
        customer: charge.externalCustomerId,
        metadata: {
          license_nonce: charge.licenseNonce,
        },
      });

      const existing = existingItems.data.find(
        (item: Stripe.InvoiceItem) =>
          item.metadata?.license_nonce === charge.licenseNonce &&
          item.metadata?.period_start === new Date(charge.periodStart * 1000).toISOString()
      );

      if (existing) {
        logger.info('[Overage Reconciler] Found existing invoice item', {
          invoiceItemId: existing.id,
        });
        return existing.id;
      }
    }

    logger.error('[Overage Reconciler] Failed to create Stripe invoice item', error as Error);
    throw error;
  }
}

/**
 * Create Polar invoice item (order) for overage charge
 *
 * @param charge - Overage charge to bill
 * @param polarConfig - Polar billing configuration
 * @returns Polar invoice item result
 */
export async function createPolarInvoiceItemForCharge(
  charge: OverageCharge,
  polarConfig: PolarMeteredConfig = DEFAULT_POLAR_METERED_CONFIG
): Promise<PolarInvoiceItemResult> {
  // Check if customer exists
  if (!charge.externalCustomerId) {
    logger.warn('[Overage Reconciler] No customer ID for Polar charge', {
      userId: charge.userId,
      licenseNonce: charge.licenseNonce,
    });
    return {
      success: false,
      amount: charge.totalCharge * 100, // Convert to cents
      currency: charge.currency.toLowerCase(),
      message: 'No external customer ID for Polar billing',
    };
  }

  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(
    charge.licenseNonce,
    charge.periodStart,
    charge.periodEnd
  );

  const input: PolarInvoiceItemInput = {
    customerId: charge.externalCustomerId,
    amount: Math.round(charge.totalCharge * 100), // Convert to cents
    currency: charge.currency.toLowerCase(),
    description: `Overage Usage - ${charge.tier} Tier (${charge.overageCredits} credits)`,
    metadata: {
      license_nonce: charge.licenseNonce,
      tier: charge.tier,
      period_start: new Date(charge.periodStart * 1000).toISOString(),
      period_end: new Date(charge.periodEnd * 1000).toISOString(),
      overage_credits: charge.overageCredits.toString(),
      event_count: charge.eventCount.toString(),
    },
    idempotencyKey,
  };

  return createPolarInvoiceItem(input, polarConfig);
}

/**
 * Mark overage events as billed
 *
 * @param eventIds - Array of event IDs to mark as billed
 * @returns Number of events updated
 */
export async function markEventsAsBilled(
  eventIds: string[]
): Promise<number> {
  if (eventIds.length === 0) {
    return 0;
  }

  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .from('overage_events')
      .update({ billable: true })
      .in('id', eventIds)
      .select('id');

    if (error) {
      throw new Error(`Database error updating events: ${error.message}`);
    }

    logger.info('[Overage Reconciler] Marked events as billed', {
      requested: eventIds.length,
      updated: data?.length || 0,
    });

    return data?.length || 0;
  } catch (error) {
    logger.error('[Overage Reconciler] Failed to mark events as billed', error as Error);
    throw error;
  }
}

/**
 * Main reconciliation function
 *
 * Scans unbilled overage events, calculates charges,
 * creates Stripe/Polar invoice items, and marks events as billed.
 *
 * @param config - Billing configuration
 * @param polarConfig - Polar billing configuration
 * @returns Reconciliation result
 */
export async function reconcileOverageEvents(
  config: OverageBillingConfig = DEFAULT_OVERAGE_BILLING_CONFIG,
  polarConfig: PolarMeteredConfig = DEFAULT_POLAR_METERED_CONFIG
): Promise<ReconciliationResult> {
  const errors: ReconciliationError[] = [];
  const charges: OverageCharge[] = [];
  let eventsMarkedAsBilled = 0;
  let invoiceItemsCreated = 0;
  let polarInvoiceItemsCreated = 0;

  logger.info('[Overage Reconciler] Starting reconciliation');

  try {
    // Step 1: Scan unbilled events
    const unbilledGroups = await scanUnbilledOverageEvents(config);

    if (unbilledGroups.length === 0) {
      return {
        success: true,
        scannedEvents: 0,
        unbilledEvents: 0,
        billableEvents: 0,
        totalOverageCredits: 0,
        totalCharge: 0,
        currency: 'USD',
        charges: [],
        invoiceItemsCreated: 0,
        eventsMarkedAsBilled: 0,
        errors: [],
      };
    }

    let totalOverageCredits = 0;
    let totalCharge = 0;

    // Step 2: Process each user group
    for (const group of unbilledGroups) {
      try {
        // Calculate charges
        const charge = calculateOverageCharges(group);
        charges.push(charge);
        totalOverageCredits += charge.overageCredits;
        totalCharge += charge.totalCharge;

        // Create Stripe invoice item if auto-create enabled
        if (config.autoCreateInvoiceItems && group.externalCustomerId) {
          await createStripeInvoiceItem(charge, config);
          invoiceItemsCreated++;
        }

        // Create Polar invoice item (order) if enabled
        if (polarConfig.enabled && group.externalCustomerId) {
          const polarResult = await createPolarInvoiceItemForCharge(charge, polarConfig);
          if (polarResult.success) {
            polarInvoiceItemsCreated++;
            logger.info('[Overage Reconciler] Polar invoice created', {
              orderId: polarResult.invoiceItemId,
              userId: charge.userId,
              amount: charge.totalCharge,
            });
          }
        }

        // Mark events as billed
        const eventIds = group.events.map((e) => e.id);
        const updated = await markEventsAsBilled(eventIds);
        eventsMarkedAsBilled += updated;
      } catch (error) {
        const err = error as Error;
        logger.error('[Overage Reconciler] Error processing user group', {
          userId: group.userId,
          error: err.message,
        });

        errors.push({
          type: err.message?.includes('Stripe') || err.message?.includes('Polar')
            ? 'billing'
            : 'calculation',
          message: `Failed to process user ${group.userId}: ${err.message}`,
          details: { userId: group.userId, licenseNonce: group.licenseNonce },
          retryable: true,
        });
      }
    }

    const result: ReconciliationResult = {
      success: errors.length === 0,
      scannedEvents: unbilledGroups.reduce((sum, g) => sum + g.events.length, 0),
      unbilledEvents: unbilledGroups.reduce((sum, g) => sum + g.events.length, 0),
      billableEvents: eventsMarkedAsBilled,
      totalOverageCredits,
      totalCharge,
      currency: 'USD',
      charges,
      invoiceItemsCreated: invoiceItemsCreated + polarInvoiceItemsCreated,
      eventsMarkedAsBilled,
      errors,
    };

    logger.info('[Overage Reconciler] Reconciliation complete', {
      scannedEvents: result.scannedEvents,
      billableEvents: result.billableEvents,
      totalCharge: result.totalCharge,
      stripeInvoiceItems: invoiceItemsCreated,
      polarInvoiceItems: polarInvoiceItemsCreated,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    const err = error as Error;
    logger.error('[Overage Reconciler] Reconciliation failed', err);

    errors.push({
      type: 'scanning',
      message: `Reconciliation failed: ${err.message}`,
      details: err,
      retryable: true,
    });

    return {
      success: false,
      scannedEvents: 0,
      unbilledEvents: 0,
      billableEvents: 0,
      totalOverageCredits: 0,
      totalCharge: 0,
      currency: 'USD',
      charges: [],
      invoiceItemsCreated: 0,
      eventsMarkedAsBilled: 0,
      errors,
    };
  }
}

/**
 * Retry reconciliation with exponential backoff
 *
 * @param maxAttempts - Maximum retry attempts
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Reconciliation result
 */
export async function reconcileOverageEventsWithRetry(
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<ReconciliationResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info('[Overage Reconciler] Attempt', { attempt, maxAttempts });

      const result = await reconcileOverageEvents();

      if (result.success) {
        return result;
      }

      // Check if all errors are retryable
      const hasNonRetryableError = result.errors.some((e) => !e.retryable);
      if (hasNonRetryableError) {
        logger.warn('[Overage Reconciler] Non-retryable error found', {
          errors: result.errors,
        });
        return result;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.info('[Overage Reconciler] Retrying after delay', { delay, attempt });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      lastError = error as Error;
      logger.error('[Overage Reconciler] Attempt failed', {
        attempt,
        error: lastError.message,
      });

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    scannedEvents: 0,
    unbilledEvents: 0,
    billableEvents: 0,
    totalOverageCredits: 0,
    totalCharge: 0,
    currency: 'USD',
    charges: [],
    invoiceItemsCreated: 0,
    eventsMarkedAsBilled: 0,
    errors: [
      {
        type: 'scanning',
        message: `All ${maxAttempts} attempts failed. Last error: ${lastError?.message}`,
        retryable: false,
      },
    ],
  };
}
