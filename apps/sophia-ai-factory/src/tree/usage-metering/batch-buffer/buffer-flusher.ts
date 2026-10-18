/**
 * Batch Flush Execution Helper for UsageBatchBuffer
 *
 * Layer: tree/usage-metering/batch-buffer
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { UsageEventInput, IngestionResult } from '../types';
import { trackUsage } from '../tracker';

export async function flushBufferedEvents(events: UsageEventInput[]): Promise<void> {
  logger.info('[UsageBuffer] Flushing events', { count: events.length });

  const results: IngestionResult[] = [];

  for (const event of events) {
    try {
      await trackUsage(event);
      results.push({ index: results.length, success: true });
    } catch (error) {
      logger.error(
        '[UsageBuffer] Failed to track event',
        error instanceof Error ? error : new Error(String(error)),
      );
      results.push({
        index: results.length,
        success: false,
        error: getErrorMessage(error),
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  logger.info('[UsageBuffer] Flush complete', {
    total: events.length,
    success: successCount,
    failed: events.length - successCount,
  });
}
