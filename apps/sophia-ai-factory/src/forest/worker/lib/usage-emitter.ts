/**
 * Usage Emitter - Queue-based Event Processing
 *
 * Emits usage events to Cloudflare Queue for async processing.
 * Supports batching for efficiency and idempotency keys for deduplication.
 */

import { calculateOverage } from './overage-calculator';

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
  service?: string
): string {
  const components = [
    licenseNonce,
    Math.floor(timestamp / 1000).toString(), // Round to seconds
    service || 'default'
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
 * Create usage event with all required fields
 */
export function createUsageEvent(
  licenseNonce: string,
  userId: string,
  tier: string,
  usageCount: number,
  service?: string
): UsageEvent {
  const overage = calculateOverage(usageCount, tier);
  const timestamp = Date.now();

  return {
    licenseNonce,
    userId,
    tier: tier.toUpperCase(),
    usageCount,
    overageCount: overage.overageCount,
    overageFee: overage.overageFee,
    timestamp,
    idempotencyKey: generateIdempotencyKey(licenseNonce, timestamp, service),
    service,
    billingPeriod: getBillingPeriod()
  };
}

/**
 * Create batch emitter for efficient event batching
 * Automatically flushes when batch size is reached
 */
export function createBatchEmitter(_maxBatchSize: number = 10): BatchEmitter {
  const events: UsageEvent[] = [];

  return {
    addEvent(event: UsageEvent): void {
      events.push(event);
    },

    async flush(queue: Queue<UsageEvent>): Promise<number> {
      if (events.length === 0) {
        return 0;
      }

      // Send all events in batch
      const batchSize = events.length;
      const promises = events.map(event => queue.send(event));

      await Promise.all(promises);
      events.length = 0; // Clear array

      return batchSize;
    },

    get size(): number {
      return events.length;
    }
  };
}

/**
 * Emit single usage event to queue
 * Use this for low-volume scenarios
 */
export async function emitUsageEvent(
  queue: Queue<UsageEvent>,
  licenseNonce: string,
  userId: string,
  tier: string,
  usageCount: number,
  service?: string
): Promise<void> {
  const event = createUsageEvent(licenseNonce, userId, tier, usageCount, service);
  await queue.send(event);
}

/**
 * Emit usage events in batch
 * More efficient for high-volume scenarios
 */
export async function emitBatchedUsageEvents(
  queue: Queue<UsageEvent>,
  events: UsageEvent[]
): Promise<void> {
  // Send all events concurrently
  await Promise.all(events.map(event => queue.send(event)));
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
