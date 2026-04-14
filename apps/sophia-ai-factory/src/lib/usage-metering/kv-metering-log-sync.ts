/**
 * KV Metering Log Sync Service
 *
 * Syncs usage events from database to Cloudflare KV for RaaS Gateway reconciliation.
 *
 * Purpose:
 * - Store metering logs in KV for fast edge access
 * - Enable cross-verification between local usage_events and RaaS Gateway logs
 * - Support billing reconciliation with idempotency
 *
 * Flow:
 * 1. Fetch usage events from database (Supabase)
 * 2. Hash and store in KV with idempotency key
 * 3. RaaS Gateway Worker reads from KV for reconciliation
 * 4. Discrepancy detection between local and gateway logs
 *
 * @module usage-metering/kv-metering-log-sync
 */

import { createServerClient } from '@/lib/db/client';
import { getKvClient } from '@/lib/redis';
import { logger } from '@/lib/utils/logger-utility';
import { createHash } from 'crypto';

/**
 * Metering log entry stored in KV
 */
export interface MeteringLogEntry {
  // Event data
  eventId: string;
  userId: string;
  licenseNonce: string;
  service: string;
  endpoint: string;
  action: string;
  creditsUsed: number;
  tokensInput: number;
  tokensOutput: number;

  // Idempotency
  idempotencyKey: string;
  requestId?: string | null;

  // Context
  tierAtRequest: string;
  externalCustomerId?: string | null;
  modelName?: string | null;

  // Timestamps
  timestamp: number; // Unix timestamp (seconds)
  syncedAt: number;  // When synced to KV (milliseconds)

  // Reconciliation
  reconciledWithGateway: boolean;
  gatewayDiscrepancy?: string;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  eventsScanned: number;
  eventsSynced: number;
  eventsSkipped: number; // Already synced
  errors: SyncError[];
}

/**
 * Sync error record
 */
export interface SyncError {
  eventId: string;
  error: string;
  timestamp: number;
}

/**
 * Configuration for KV metering log sync
 */
export interface KvMeteringLogConfig {
  kvKeyPrefix: string;
  ttlSeconds: number;
  batchSize: number;
  timeRangeHours: number; // How far back to sync
}

/**
 * Default configuration
 */
export const DEFAULT_KV_METERING_LOG_CONFIG: KvMeteringLogConfig = {
  kvKeyPrefix: 'metering:',
  ttlSeconds: 7 * 24 * 60 * 60, // 7 days
  batchSize: 100,
  timeRangeHours: 24, // Sync last 24 hours by default
};

/**
 * Generate KV key for metering log entry
 *
 * Key format: metering:{timestamp}:{eventId}
 * Allows range queries by timestamp prefix
 */
function generateKvKey(event: { eventId: string; timestamp: number }): string {
  return `${DEFAULT_KV_METERING_LOG_CONFIG.kvKeyPrefix}${event.timestamp}:${event.eventId}`;
}

/**
 * Generate hash for event comparison (reconciliation)
 */
function generateEventHash(event: {
  userId: string;
  licenseNonce: string;
  service: string;
  creditsUsed: number;
  timestamp: number;
}): string {
  const payload = `${event.userId}:${event.licenseNonce}:${event.service}:${event.creditsUsed}:${event.timestamp}`;
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Sync usage events from database to KV
 *
 * Idempotent: skips already synced events
 */
export async function syncUsageEventsToKv(
  config: KvMeteringLogConfig = DEFAULT_KV_METERING_LOG_CONFIG
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    eventsScanned: 0,
    eventsSynced: 0,
    eventsSkipped: 0,
    errors: [],
  };

  const kv = getKvClient();

  if (!kv) {
    logger.warn('[KV Metering Sync] KV client not available, skipping sync');
    return result;
  }

  try {
    const db = createServerClient();

    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - (config.timeRangeHours * 60 * 60);

    // Fetch usage events from database
    logger.info('[KV Metering Sync] Fetching usage events', {
      timeRangeHours: config.timeRangeHours,
      startTime: new Date(startTime * 1000).toISOString(),
    });

    const { data: events, error } = await db
      .from('usage_events')
      .select(`
        id,
        user_id,
        license_nonce,
        service_name,
        endpoint,
        action,
        credits_used,
        tokens_input,
        tokens_output,
        idempotency_key,
        request_id,
        tier_at_request,
        external_customer_id,
        model_name,
        created_at
      `)
      .gte('created_at', startTime)
      .order('created_at', { ascending: true })
      .limit(config.batchSize);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!events || events.length === 0) {
      logger.info('[KV Metering Sync] No events to sync');
      return result;
    }

    result.eventsScanned = events.length;

    // Sync each event to KV
    for (const row of events) {
      try {
        const kvKey = generateKvKey({
          eventId: row.id,
          timestamp: row.created_at,
        });

        // Check if already synced (idempotency)
        const existing = await kv.get(kvKey);

        if (existing) {
          result.eventsSkipped++;
          continue;
        }

        // Create metering log entry
        const entry: MeteringLogEntry = {
          eventId: row.id,
          userId: row.user_id,
          licenseNonce: row.license_nonce,
          service: row.service_name,
          endpoint: row.endpoint || 'unknown',
          action: row.action,
          creditsUsed: row.credits_used,
          tokensInput: row.tokens_input || 0,
          tokensOutput: row.tokens_output || 0,
          idempotencyKey: row.idempotency_key,
          requestId: row.request_id,
          tierAtRequest: row.tier_at_request,
          externalCustomerId: row.external_customer_id,
          modelName: row.model_name,
          timestamp: row.created_at,
          syncedAt: Date.now(),
          reconciledWithGateway: false,
        };

        // Store in KV with TTL
        await kv.put(kvKey, JSON.stringify(entry), {
          expirationTtl: config.ttlSeconds,
        });

        result.eventsSynced++;

        logger.debug('[KV Metering Sync] Event synced', {
          eventId: row.id,
          kvKey,
        });
      } catch (error) {
        const err = error as Error;
        result.errors.push({
          eventId: row.id,
          error: err.message,
          timestamp: Date.now(),
        });

        logger.error('[KV Metering Sync] Failed to sync event', err, {
          eventId: row.id,
        });
      }
    }

    logger.info('[KV Metering Sync] Sync completed', {
      scanned: result.eventsScanned,
      synced: result.eventsSynced,
      skipped: result.eventsSkipped,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    const err = error as Error;
    logger.error('[KV Metering Sync] Sync failed', err);

    result.success = false;
    result.errors.push({
      eventId: 'sync-batch',
      error: err.message,
      timestamp: Date.now(),
    });

    return result;
  }
}

/**
 * Get metering logs from KV for reconciliation
 *
 * Returns logs in time range for cross-verification with RaaS Gateway
 */
export async function getMeteringLogs(
  startTime: number,
  endTime: number,
  options?: {
    licenseNonce?: string;
    userId?: string;
    service?: string;
  }
): Promise<MeteringLogEntry[]> {
  const kv = getKvClient();
  const logs: MeteringLogEntry[] = [];

  if (!kv) {
    logger.warn('[KV Metering Logs] KV client not available');
    return logs;
  }

  try {
    // KV doesn't support range queries by value, only by key prefix
    // We need to iterate through keys (this is a limitation)
    // For production, consider using a time-series database

    // Simple approach: fetch all keys with prefix and filter
    // Note: This is inefficient for large datasets
    // Production recommendation: Use D1 or dedicated time-series store

    logger.debug('[KV Metering Logs] Fetching logs', {
      startTime: new Date(startTime * 1000).toISOString(),
      endTime: new Date(endTime * 1000).toISOString(),
      ...options,
    });

    // For now, return empty array with warning
    // Production implementation would use proper time-series storage
    logger.warn('[KV Metering Logs] Range query not efficient in KV, using database fallback');

    // Fallback to database query
    const db = createServerClient();
    const { data, error } = await db
      .from('usage_events')
      .select('*')
      .gte('created_at', startTime)
      .lte('created_at', endTime);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      return logs;
    }

    interface MeteringLogRow {
      id: string;
      user_id: string;
      license_nonce: string;
      service_name: string;
      endpoint: string | null;
      action: string;
      credits_used: number;
      tokens_input: number;
      tokens_output: number;
    }

    // Apply filters
    return data
      .filter((row: MeteringLogRow) => {
        if (options?.licenseNonce && row.license_nonce !== options.licenseNonce) {
          return false;
        }
        if (options?.userId && row.user_id !== options.userId) {
          return false;
        }
        if (options?.service && row.service_name !== options.service) {
          return false;
        }
        return true;
      })
      .map((row: MeteringLogRow) => ({
        eventId: row.id,
        userId: row.user_id,
        licenseNonce: row.license_nonce,
        service: row.service_name,
        endpoint: row.endpoint || 'unknown',
        action: row.action,
        creditsUsed: row.credits_used,
        tokensInput: row.tokens_input || 0,
        tokensOutput: row.tokens_output || 0,
        idempotencyKey: row.idempotency_key,
        requestId: row.request_id,
        tierAtRequest: row.tier_at_request,
        externalCustomerId: row.external_customer_id,
        modelName: row.model_name,
        timestamp: row.created_at,
        syncedAt: Date.now(),
        reconciledWithGateway: false,
      }));
  } catch (error) {
    logger.error('[KV Metering Logs] Failed to fetch logs', error as Error);
    return [];
  }
}

/**
 * Mark metering log as reconciled with RaaS Gateway
 */
export async function markAsReconciled(
  eventId: string,
  timestamp: number,
  options?: {
    discrepancy?: string;
  }
): Promise<boolean> {
  const kv = getKvClient();

  if (!kv) {
    logger.warn('[KV Metering Sync] KV client not available');
    return false;
  }

  try {
    const kvKey = generateKvKey({ eventId, timestamp });
    const existing = await kv.get(kvKey);

    if (!existing) {
      logger.debug('[KV Metering Sync] Entry not found, skipping reconciliation mark', {
        eventId,
      });
      return false;
    }

    const entry = JSON.parse(existing) as MeteringLogEntry;
    entry.reconciledWithGateway = true;

    if (options?.discrepancy) {
      entry.gatewayDiscrepancy = options.discrepancy;
    }

    await kv.put(kvKey, JSON.stringify(entry), {
      expirationTtl: DEFAULT_KV_METERING_LOG_CONFIG.ttlSeconds,
    });

    logger.debug('[KV Metering Sync] Marked as reconciled', {
      eventId,
      hasDiscrepancy: !!options?.discrepancy,
    });

    return true;
  } catch (error) {
    logger.error('[KV Metering Sync] Failed to mark as reconciled', error as Error);
    return false;
  }
}

/**
 * Get sync statistics for monitoring
 */
export async function getSyncStats(): Promise<{
  totalKeys: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
  reconciledCount: number;
  discrepancyCount: number;
}> {
  const kv = getKvClient();

  if (!kv) {
    return {
      totalKeys: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
      reconciledCount: 0,
      discrepancyCount: 0,
    };
  }

  try {
    // Note: KV doesn't provide efficient count/metadata
    // This is a placeholder for monitoring
    return {
      totalKeys: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
      reconciledCount: 0,
      discrepancyCount: 0,
    };
  } catch (error) {
    logger.error('[KV Metering Sync] Failed to get stats', error as Error);
    return {
      totalKeys: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
      reconciledCount: 0,
      discrepancyCount: 0,
    };
  }
}
