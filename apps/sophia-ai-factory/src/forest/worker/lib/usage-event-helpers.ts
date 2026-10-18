/**
 * Usage Event Types, Key Generators & Structure Validation
 *
 * Layer: forest/worker/lib
 *
 * @module forest/worker/lib/usage-event-helpers
 */

/**
 * Usage event structure for queue
 */
export interface UsageEvent {
  licenseNonce: string;      // Unique license identifier
  userId: string;            // User ID from JWT
  tier: string;              // Subscription tier
  usageCount: number;        // Total usage count
  overageCount: number;      // Requests over base limit
  overageFee: number;        // Calculated overage fee in USD
  timestamp: number;         // Unix timestamp in ms
  idempotencyKey: string;    // Unique key for deduplication
  service?: string;          // Optional service identifier
  billingPeriod?: string;    // Billing period (YYYY-MM)
}

/**
 * Batch emitter for efficient queue operations
 */
export interface BatchEmitter {
  addEvent(event: UsageEvent): void;
  flush(queue: Queue<UsageEvent>): Promise<number>;
  size: number;
}

/**
 * Generate idempotency key from event data
 * Ensures duplicate events are not processed
 */
export function generateIdempotencyKey(
  licenseNonce: string,
  timestamp: number,
  service?: string,
): string {
  const components = [
    licenseNonce,
    Math.floor(timestamp / 1000).toString(), // Round to seconds
    service || 'default',
  ];
  return `evt_${components.join('_')}`;
}

/**
 * Get current billing period string
 */
export function getBillingPeriod(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${year}-${month}`;
}

/**
 * Validate usage event structure
 */
export function validateUsageEvent(event: unknown): event is UsageEvent {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const e = event as Record<string, unknown>;

  return (
    typeof e.licenseNonce === 'string' &&
    typeof e.userId === 'string' &&
    typeof e.tier === 'string' &&
    typeof e.usageCount === 'number' &&
    typeof e.overageCount === 'number' &&
    typeof e.overageFee === 'number' &&
    typeof e.timestamp === 'number' &&
    typeof e.idempotencyKey === 'string' &&
    (e.service === undefined || typeof e.service === 'string') &&
    (e.billingPeriod === undefined || typeof e.billingPeriod === 'string')
  );
}
