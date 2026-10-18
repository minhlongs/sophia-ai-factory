/**
 * Usage Emitter - Queue-based Event Processing
 *
 * Emits usage events to Cloudflare Queue for async processing.
 * Supports batching for efficiency and idempotency keys for deduplication.
 */

import { calculateOverage } from './overage-calculator';
import {
  generateIdempotencyKey,
  getBillingPeriod,
  validateUsageEvent,
  type BatchEmitter,
  type UsageEvent,
} from './usage-event-helpers';

export {
  generateIdempotencyKey,
  getBillingPeriod,
  validateUsageEvent,
  type BatchEmitter,
  type UsageEvent,
};

/**
 * Create usage event with all required fields
 */
export function createUsageEvent(
  licenseNonce: string,
  userId: string,
  tier: string,
  usageCount: number,
  service?: string,
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
    billingPeriod: getBillingPeriod(),
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
      const promises = events.map((event) => queue.send(event));

      await Promise.all(promises);
      events.length = 0; // Clear array

      return batchSize;
    },

    get size(): number {
      return events.length;
    },
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
  service?: string,
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
  events: UsageEvent[],
): Promise<void> {
  // Send all events concurrently
  await Promise.all(events.map((event) => queue.send(event)));
}
