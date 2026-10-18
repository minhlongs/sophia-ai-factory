import { logger } from '@/seed/utils/logger-utility';
import type { UsageEventInput } from '../types';
import { generateIdempotencyKey } from '../idempotency';
import type { BufferStats } from './types';
import { flushBufferedEvents } from './buffer-flusher';

/**
 * In-memory buffer for batch ingestion
 *
 * Automatically flushes when:
 * - Buffer reaches max batch size (100 events)
 * - Time interval elapsed (5 seconds)
 */
export class UsageBatchBuffer {
  private buffer: Map<string, UsageEventInput> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private maxBatchSize = 100;
  private flushDelayMs = 5000;
  private isFlushing = false;

  constructor() {
    this.startAutoFlush();
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      if (!this.isFlushing && this.buffer.size > 0) {
        this.flush();
      }
    }, this.flushDelayMs);

    if (this.flushInterval && typeof this.flushInterval.unref === 'function') {
      this.flushInterval.unref();
    }
  }

  public stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  public add(event: UsageEventInput): boolean {
    const key = event.idempotencyKey || generateIdempotencyKey({
      requestId: event.requestId,
      userId: event.userId,
      licenseNonce: event.licenseNonce,
      service: event.service,
      action: event.action,
      timestamp: event.createdAt ?? Date.now(),
    });

    if (this.buffer.has(key)) {
      logger.debug('[UsageBuffer] Duplicate event in buffer', { key });
      return false;
    }

    this.buffer.set(key, {
      ...event,
      idempotencyKey: key,
    });

    if (this.buffer.size >= this.maxBatchSize) {
      logger.info('[UsageBuffer] Buffer full, triggering auto-flush', {
        size: this.buffer.size,
      });
      this.flush();
    }

    return true;
  }

  public async flush(): Promise<void> {
    if (this.buffer.size === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;
    const events = Array.from(this.buffer.values());
    this.buffer.clear();

    try {
      await flushBufferedEvents(events);
    } catch (error) {
      logger.error(
        '[UsageBuffer] Critical error during flush',
        error instanceof Error ? error : new Error(String(error)),
      );

      for (const event of events) {
        if (event.idempotencyKey) {
          this.buffer.set(event.idempotencyKey, event);
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  public get size(): number {
    return this.buffer.size;
  }

  public clear(): void {
    this.buffer.clear();
  }

  public getStats(): BufferStats {
    return {
      size: this.buffer.size,
      isFlushing: this.isFlushing,
    };
  }
}

export const usageBuffer = new UsageBatchBuffer();
