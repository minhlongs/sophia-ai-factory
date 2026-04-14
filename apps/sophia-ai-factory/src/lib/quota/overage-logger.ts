/**
 * Overage Event Logger
 *
 * Async logging for quota exceeded events with:
 * - Batch writes for efficiency
 * - Retry on failure
 * - Integration with billing webhooks (Stripe/Polar)
 * - KV buffer for high-throughput scenarios
 *
 * @module quota/overage-logger
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Overage event input
 */
export interface OverageEventInput {
  userId: string;
  licenseNonce: string;
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  exceededLimit: number;
  exceededCurrent: number;
  exceededBy: number;
  requestedCredits: number;
  tier: string;
  endpoint?: string;
  service?: string;
  action?: string;
  ipAddress?: string;
  userAgent?: string;
  externalCustomerId?: string;
}

/**
 * Batch buffer for overage events
 * Flushes every 10 events or 5 seconds
 */
class OverageEventBuffer {
  private buffer: OverageEventInput[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly MAX_BUFFER_SIZE = 10;
  private readonly FLUSH_INTERVAL_MS = 5000;

  /**
   * Add event to buffer
   */
  async add(event: OverageEventInput): Promise<void> {
    this.buffer.push(event);

    // Flush if buffer is full
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      await this.flush();
      return;
    }

    // Start flush timer if not running
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush().catch(err => {
          logger.error('[Overage Logger] Buffered flush error', err);
        });
        this.flushTimer = null;
      }, this.FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Flush buffer to database
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      const db = createServerClient();
      const { error } = await (db as any).from('overage_events').insert(
        events.map(event => ({
          user_id: event.userId,
          license_nonce: event.licenseNonce,
          exceeded_type: event.exceededType,
          exceeded_limit: event.exceededLimit,
          exceeded_current: event.exceededCurrent,
          exceeded_by: event.exceededBy,
          requested_credits: event.requestedCredits,
          endpoint: event.endpoint,
          service_name: event.service,
          action: event.action,
          tier_at_exceeded: event.tier,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          billable: false,
        }))
      ) as any;

      if (error) throw error;

      logger.info('[Overage Logger] Flushed batch', { count: events.length });
    } catch (error) {
      logger.error('[Overage Logger] Batch flush failed', error as Error);
      // Re-add to buffer for retry (with limit)
      if (this.buffer.length < 100) {
        this.buffer.unshift(...events);
      } else {
        logger.error('[Overage Logger] Dropped events due to buffer overflow');
      }
    }
  }

  /**
   * Force flush and disable buffer
   */
  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

// Singleton buffer instance
let globalBuffer: OverageEventBuffer | null = null;

function getBuffer(): OverageEventBuffer {
  if (!globalBuffer) {
    globalBuffer = new OverageEventBuffer();
  }
  return globalBuffer;
}

/**
 * Log single overage event immediately (non-buffered)
 * Use for critical/first-time overage events
 */
export async function logOverageEventImmediate(
  event: OverageEventInput
): Promise<string | null> {
  try {
    const { data, error } = await (createServerClient() as any)
      .from('overage_events')
      .insert({
        user_id: event.userId,
        license_nonce: event.licenseNonce,
        exceeded_type: event.exceededType,
        exceeded_limit: event.exceededLimit,
        exceeded_current: event.exceededCurrent,
        exceeded_by: event.exceededBy,
        requested_credits: event.requestedCredits,
        endpoint: event.endpoint,
        service_name: event.service,
        action: event.action,
        tier_at_exceeded: event.tier,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        external_customer_id: event.externalCustomerId,
        billable: false,
      })
      .select('id')
      .single() as any;

    if (error) throw error;

    logger.warn('[Overage Logger] Event logged', {
      eventId: (data as any)?.id,
      userId: event.userId,
      exceededType: event.exceededType,
      exceededBy: event.exceededBy,
    });

    return data.id;
  } catch (error) {
    logger.error('[Overage Logger] Failed to log event', error as Error);
    return null;
  }
}

/**
 * Log overage event with buffering (default)
 * Use for high-throughput scenarios
 */
export async function logOverageEvent(
  event: OverageEventInput,
  options: { buffered?: boolean } = { buffered: true }
): Promise<string | null> {
  if (!options.buffered) {
    return logOverageEventImmediate(event);
  }

  // Add to buffer (async, fire-and-forget)
  getBuffer().add(event).catch(err => {
    logger.error('[Overage Logger] Buffer add error', err);
  });

  return null; // Buffered events don't return ID immediately
}

/**
 * Get overage events for a user
 * For dashboard display
 */
export async function getUserOverageEvents(
  userId: string,
  options: { limit?: number; startDate?: number; endDate?: number } = {}
): Promise<Array<{
  id: string;
  exceededType: string;
  exceededLimit: number;
  exceededCurrent: number;
  exceededBy: number;
  tierAtExceeded: string;
  createdAt: number;
  billable: boolean;
}>> {
  const db = createServerClient();
  const limit = options.limit ?? 10;

  let query = db
    .from('overage_events')
    .select('id, exceeded_type, exceeded_limit, exceeded_current, exceeded_by, tier_at_exceeded, created_at, billable')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit) as any;

  if (options.startDate) {
    query = query.gte('created_at', options.startDate);
  }
  if (options.endDate) {
    query = query.lte('created_at', options.endDate);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('[Overage Logger] Failed to fetch events', error);
    return [];
  }

  interface OverageEventRow {
    id: string;
    exceeded_type: string;
    exceeded_limit: number;
    exceeded_current: number;
    exceeded_by: number;
    tier_at_exceeded: string;
    created_at: string;
    billable: boolean;
  }

  return (data || []).map((row: OverageEventRow) => ({
    id: row.id,
    exceededType: row.exceeded_type,
    exceededLimit: row.exceeded_limit,
    exceededCurrent: row.exceeded_current,
    exceededBy: row.exceeded_by,
    tierAtExceeded: row.tier_at_exceeded,
    createdAt: row.created_at,
    billable: row.billable,
  }));
}

/**
 * Get overage summary for billing period
 */
export async function getOverageSummary(
  licenseNonce: string,
  periodStart: number,
  periodEnd: number
): Promise<{
  totalOverageEvents: number;
  totalOverageCredits: number;
  byType: Record<string, number>;
  billableEvents: number;
}> {
  const db = createServerClient();

  interface OverageSummaryRow {
    exceeded_by: number;
    exceeded_type: string;
    billable: boolean;
  }

  const { data, error } = await db
    .from('overage_events')
    .select('exceeded_by, exceeded_type, billable')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd) as { data: OverageSummaryRow[] | null; error: typeof error };

  if (error) {
    logger.error('[Overage Logger] Failed to fetch summary', error);
    return {
      totalOverageEvents: 0,
      totalOverageCredits: 0,
      byType: {},
      billableEvents: 0,
    };
  }

  const summary = {
    totalOverageEvents: data?.length || 0,
    totalOverageCredits: data?.reduce((sum, e) => sum + (e.exceeded_by || 0), 0) || 0,
    byType: {} as Record<string, number>,
    billableEvents: data?.filter((e) => e.billable).length || 0,
  };

  // Group by type
  data?.forEach((event: OverageSummaryRow) => {
    summary.byType[event.exceeded_type] = (summary.byType[event.exceeded_type] || 0) + 1;
  });

  return summary;
}

/**
 * Mark overage events as billable
 * Called by billing reconciliation process
 */
export async function markEventsAsBillable(
  eventIds: string[],
  pricePerCredit: number
): Promise<number> {
  if (eventIds.length === 0) return 0;

  try {
    const { error } = await (createServerClient() as any)
      .from('overage_events')
      .update({ billable: true } as any)
      .in('id', eventIds) as any;

    if (error) {
      logger.error('[Overage Logger] Failed to mark events as billable', error);
      return 0;
    }

    logger.info('[Overage Logger] Marked events as billable', {
      count: eventIds.length,
      pricePerCredit,
    });

    return eventIds.length;
  } catch (error) {
    logger.error('[Overage Logger] Error marking events as billable', error instanceof Error ? error : new Error(String(error)));
    return 0;
  }
}

/**
 * Flush buffer on process exit
 */
if (typeof process !== 'undefined' && process.on) {
  process.on('SIGTERM', async () => {
    if (globalBuffer) {
      await globalBuffer.destroy();
    }
  });

  process.on('SIGINT', async () => {
    if (globalBuffer) {
      await globalBuffer.destroy();
    }
  });
}
