/**
 * Polar.sh Usage Reporter
 *
 * Reports usage events to Polar.sh metered billing API.
 * Handles batching, timestamp management, and error recovery.
 *
 * Features:
 * - Batch usage reporting for efficiency
 * - Automatic timestamp handling
 * - Error recovery with retry queue
 * - Integration with quota/overage tracking
 *
 * @module billing/polar-usage-reporter
 */

import { logger } from '@/lib/utils/logger-utility';
import {
  recordPolarUsage,
  type PolarUsageRecordInput,
  type PolarUsageRecordResult,
  type PolarMeteredConfig,
  DEFAULT_POLAR_METERED_CONFIG,
} from './polar-metered-billing';

/**
 * Usage event to be reported
 */
export interface UsageEvent {
  /** Unique event identifier */
  eventId: string;
  /** Polar customer ID */
  customerId: string;
  /** Meter slug (e.g., 'api_credits', 'api_requests') */
  meterSlug: string;
  /** Quantity to report */
  quantity: number;
  /** Event timestamp (Unix seconds) */
  timestamp: number;
  /** Optional metadata */
  metadata?: Record<string, string>;
}

/**
 * Batch usage report result
 */
export interface BatchUsageReportResult {
  totalAttempted: number;
  totalSuccessful: number;
  totalFailed: number;
  results: PolarUsageRecordResult[];
  failedEvents: UsageEvent[];
}

/**
 * Report single usage event to Polar
 *
 * @param event - Usage event to report
 * @param config - Metered billing configuration
 * @returns Result of usage recording
 */
export async function reportUsageEvent(
  event: UsageEvent,
  config: PolarMeteredConfig = DEFAULT_POLAR_METERED_CONFIG
): Promise<PolarUsageRecordResult> {
  const input: PolarUsageRecordInput = {
    customerId: event.customerId,
    meterSlug: event.meterSlug,
    quantity: event.quantity,
    idempotencyKey: `usage_${event.eventId}_${event.timestamp}`,
    timestamp: new Date(event.timestamp * 1000).toISOString(),
    metadata: event.metadata,
  };

  return recordPolarUsage(input, config);
}

/**
 * Batch report multiple usage events
 *
 * @param events - Array of usage events to report
 * @param config - Metered billing configuration
 * @returns Batch report result
 *
 * @example
 * const result = await batchReportUsage([
 *   { eventId: 'evt_1', customerId: 'cust_123', meterSlug: 'api_credits', quantity: 100, timestamp: 1234567890 },
 *   { eventId: 'evt_2', customerId: 'cust_456', meterSlug: 'api_requests', quantity: 50, timestamp: 1234567891 },
 * ]);
 */
export async function batchReportUsage(
  events: UsageEvent[],
  config: PolarMeteredConfig = DEFAULT_POLAR_METERED_CONFIG
): Promise<BatchUsageReportResult> {
  if (events.length === 0) {
    logger.debug('[Polar Usage Reporter] No events to report');
    return {
      totalAttempted: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      results: [],
      failedEvents: [],
    };
  }

  logger.info('[Polar Usage Reporter] Batch reporting started', {
    totalEvents: events.length,
  });

  const results: PolarUsageRecordResult[] = [];
  const failedEvents: UsageEvent[] = [];

  // Process events with concurrency control
  const concurrencyLimit = 5;
  for (let i = 0; i < events.length; i += concurrencyLimit) {
    const batch = events.slice(i, i + concurrencyLimit);

    const batchResults = await Promise.all(
      batch.map((event) => reportUsageEvent(event, config))
    );

    batchResults.forEach((result, index) => {
      results.push(result);
      if (!result.success) {
        failedEvents.push(batch[index]);
      }
    });

    // Rate limiting delay between batches
    if (i + concurrencyLimit < events.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info('[Polar Usage Reporter] Batch reporting completed', {
    totalAttempted: events.length,
    totalSuccessful: successful,
    totalFailed: failed,
    retryableFailures: failedEvents.filter(
      (_, i) => results[i].retryable
    ).length,
  });

  return {
    totalAttempted: events.length,
    totalSuccessful: successful,
    totalFailed: failed,
    results,
    failedEvents,
  };
}

/**
 * Queue for retrying failed events
 */
class UsageRetryQueue {
  private queue: Array<{ event: UsageEvent; attempts: number }> = [];
  private readonly maxAttempts: number;

  constructor(maxAttempts: number = 3) {
    this.maxAttempts = maxAttempts;
  }

  /**
   * Add failed event to retry queue
   */
  add(event: UsageEvent): void {
    const existing = this.queue.find(
      (item) => item.event.eventId === event.eventId
    );

    if (existing) {
      existing.attempts++;
    } else {
      this.queue.push({ event, attempts: 1 });
    }
  }

  /**
   * Get events ready for retry
   */
  getRetryableEvents(): Array<{ event: UsageEvent; attempts: number }> {
    return this.queue.filter(
      (item) => item.attempts < this.maxAttempts
    );
  }

  /**
   * Remove successfully processed event
   */
  remove(eventId: string): void {
    this.queue = this.queue.filter(
      (item) => item.event.eventId !== eventId
    );
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }
}

/**
 * Global retry queue instance
 */
let globalRetryQueue: UsageRetryQueue | null = null;

/**
 * Get or create global retry queue
 */
export function getRetryQueue(): UsageRetryQueue {
  if (!globalRetryQueue) {
    globalRetryQueue = new UsageRetryQueue();
  }
  return globalRetryQueue;
}

/**
 * Report usage with automatic retry for failures
 *
 * @param events - Usage events to report
 * @param config - Metered billing configuration
 * @returns Batch report result with retry queue updated
 */
export async function reportUsageWithRetry(
  events: UsageEvent[],
  config: PolarMeteredConfig = DEFAULT_POLAR_METERED_CONFIG
): Promise<BatchUsageReportResult> {
  const result = await batchReportUsage(events, config);

  // Add retryable failures to queue
  const queue = getRetryQueue();
  result.failedEvents.forEach((event, index) => {
    if (result.results[index]?.retryable) {
      queue.add(event);
    }
  });

  logger.debug('[Polar Usage Reporter] Retry queue updated', {
    queueSize: queue.size(),
  });

  return result;
}

/**
 * Process retry queue
 *
 * @param config - Metered billing configuration
 * @returns Result of retry processing
 */
export async function processRetryQueue(
  config: PolarMeteredConfig = DEFAULT_POLAR_METERED_CONFIG
): Promise<BatchUsageReportResult> {
  const queue = getRetryQueue();
  const retryableEvents = queue.getRetryableEvents();

  if (retryableEvents.length === 0) {
    logger.debug('[Polar Usage Reporter] No events to retry');
    return {
      totalAttempted: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      results: [],
      failedEvents: [],
    };
  }

  logger.info('[Polar Usage Reporter] Processing retry queue', {
    count: retryableEvents.length,
  });

  const events = retryableEvents.map((item) => item.event);
  const result = await batchReportUsage(events, config);

  // Remove successful events from queue
  result.results.forEach((res, index) => {
    if (res.success) {
      queue.remove(events[index].eventId);
    }
  });

  return result;
}

/**
 * Create usage event from overage data
 */
export function createOverageUsageEvent(
  userId: string,
  polarCustomerId: string,
  exceededBy: number,
  exceededType: string,
  licenseNonce: string,
  eventId?: string
): UsageEvent {
  const timestamp = Math.floor(Date.now() / 1000);
  const meterSlug = exceededType.includes('requests')
    ? 'api_requests'
    : 'api_credits';

  return {
    eventId: eventId || `overage_${licenseNonce}_${timestamp}`,
    customerId: polarCustomerId,
    meterSlug,
    quantity: exceededBy,
    timestamp,
    metadata: {
      license_nonce: licenseNonce,
      exceeded_type: exceededType,
      user_id: userId,
    },
  };
}

/**
 * Create usage event from quota consumption
 */
export function createQuotaUsageEvent(
  userId: string,
  polarCustomerId: string,
  consumed: number,
  quotaType: string,
  eventId?: string
): UsageEvent {
  const timestamp = Math.floor(Date.now() / 1000);
  const meterSlug = quotaType.includes('request')
    ? 'api_requests'
    : 'api_credits';

  return {
    eventId: eventId || `quota_${userId}_${timestamp}`,
    customerId: polarCustomerId,
    meterSlug,
    quantity: consumed,
    timestamp,
    metadata: {
      quota_type: quotaType,
      user_id: userId,
    },
  };
}
