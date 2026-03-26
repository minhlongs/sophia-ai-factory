/**
 * Usage Metering - Batch Buffer
 *
 * In-memory buffer for batching usage events with auto-flush
 * Prevents database saturation and enables retry logic
 */

import { logger } from '@/lib/utils/logger-utility';
import type { UsageEventInput, IngestionResult } from './types';
import { generateIdempotencyKey } from './idempotency';
import { trackUsage } from './tracker';

/**
 * In-memory buffer for batch ingestion
 *
 * Automatically flushes when:
 * - Buffer reaches max batch size (100 events)
 * - Time interval elapsed (5 seconds)
 */
class UsageBatchBuffer {
  private buffer: Map<string, UsageEventInput> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private maxBatchSize = 100;
  private flushDelayMs = 5000;
  private isFlushing = false;

  constructor() {
    // Auto-flush every 5 seconds
    this.startAutoFlush();
  }

  /**
   * Start auto-flush interval
   */
  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      if (!this.isFlushing && this.buffer.size > 0) {
        this.flush();
      }
    }, this.flushDelayMs);

    // Prevent interval from keeping process alive
    if (this.flushInterval && typeof this.flushInterval.unref === 'function') {
      this.flushInterval.unref();
    }
  }

  /**
   * Stop auto-flush interval
   */
  public stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Add event to buffer
   *
   * @param event - Usage event to buffer
   * @returns True if added, false if duplicate
   */
  public add(event: UsageEventInput): boolean {
    // Generate idempotency key if not provided
    const key = event.idempotencyKey || generateIdempotencyKey({
      requestId: event.requestId,
      userId: event.userId,
      licenseNonce: event.licenseNonce,
      service: event.service,
      action: event.action,
      timestamp: event.createdAt ?? Date.now(),
    });

    // Idempotency: skip if already in buffer
    if (this.buffer.has(key)) {
      logger.debug('[UsageBuffer] Duplicate event in buffer', { key });
      return false;
    }

    this.buffer.set(key, {
      ...event,
      idempotencyKey: key,
    });

    // Auto-flush if buffer full
    if (this.buffer.size >= this.maxBatchSize) {
      logger.info('[UsageBuffer] Buffer full, triggering auto-flush', {
        size: this.buffer.size
      });
      // Don't await - flush in background
      this.flush();
    }

    return true;
  }

  /**
   * Flush buffer to database
   */
  public async flush(): Promise<void> {
    if (this.buffer.size === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    const events = Array.from(this.buffer.values());
    this.buffer.clear();

    try {
      logger.info('[UsageBuffer] Flushing events', { count: events.length });

      // Batch insert all events
      // Note: trackUsage already handles idempotency checks
      const results: IngestionResult[] = [];

      for (const event of events) {
        try {
          await trackUsage(event);
          results.push({ index: results.length, success: true });
        } catch (error) {
          logger.error('[UsageBuffer] Failed to track event', error instanceof Error ? error : new Error(String(error)));
          results.push({
            index: results.length,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      logger.info('[UsageBuffer] Flush complete', {
        total: events.length,
        success: successCount,
        failed: events.length - successCount
      });

    } catch (error) {
      logger.error('[UsageBuffer] Critical error during flush', error instanceof Error ? error : new Error(String(error)));

      // Re-add failed events to buffer (they'll be retried next flush)
      for (const event of events) {
        if (event.idempotencyKey) {
          this.buffer.set(event.idempotencyKey, event);
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Get current buffer size
   */
  public get size(): number {
    return this.buffer.size;
  }

  /**
   * Clear buffer (for testing)
   */
  public clear(): void {
    this.buffer.clear();
  }

  /**
   * Get buffer stats
   */
  public getStats(): { size: number; isFlushing: boolean } {
    return {
      size: this.buffer.size,
      isFlushing: this.isFlushing,
    };
  }
}

// Singleton instance
export const usageBuffer = new UsageBatchBuffer();

// Graceful shutdown handling (Node.js only - not available in Edge Runtime)
if (
  typeof process !== 'undefined' &&
  typeof (process as NodeJS.Process & { on?: unknown }).on === 'function' &&
  typeof window === 'undefined'
) {
  const proc = process as NodeJS.Process;
  proc.on('beforeExit', () => { usageBuffer.stop(); });
  proc.on('SIGTERM', () => { usageBuffer.stop(); });
  proc.on('SIGINT', () => { usageBuffer.stop(); });
}
