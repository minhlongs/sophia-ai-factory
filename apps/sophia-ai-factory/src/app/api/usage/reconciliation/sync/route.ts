/**
 * Usage Reconciliation Sync API Endpoint
 *
 * Triggers synchronization of usage events to Cloudflare KV
 * for RaaS Gateway metering log reconciliation.
 *
 * GET /api/usage/reconciliation/sync
 * - Triggers sync of last 24 hours of usage events to KV
 * - Returns sync statistics
 *
 * POST /api/usage/reconciliation/sync
 * Body: { timeRangeHours?: number; batchSize?: number }
 * - Custom sync configuration
 *
 * @module api/usage/reconciliation/sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { verifyInternalSecret } from '@/seed/security/verify-internal-secret';
import {
  syncUsageEventsToKv,
  getSyncStats,
  type KvMeteringLogConfig,
} from '@/lib/usage-metering/kv-metering-log-sync';
import { logAuditEvent } from '@/lib/audit/audit-logger';

interface UsageReconciliationSyncRequest {
  timeRangeHours?: number;
  batchSize?: number;
}

/**
 * GET - Trigger sync and return statistics
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    logger.info('[Usage Reconciliation Sync] Starting sync (GET)', { requestId });

    // Trigger sync with default config
    const syncResult = await syncUsageEventsToKv();

    // Get stats
    const stats = await getSyncStats();

    // Log audit event
    await logAuditEvent({
      action: 'usage_reconciliation_sync',
      userId: 'system',
      metadata: {
        requestId,
        eventsScanned: syncResult.eventsScanned,
        eventsSynced: syncResult.eventsSynced,
        eventsSkipped: syncResult.eventsSkipped,
        errors: syncResult.errors.length,
      },
    });

    return NextResponse.json({
      success: syncResult.success,
      sync: {
        eventsScanned: syncResult.eventsScanned,
        eventsSynced: syncResult.eventsSynced,
        eventsSkipped: syncResult.eventsSkipped,
        errors: syncResult.errors,
      },
      stats,
      requestId,
    });
  } catch (error) {
    logger.error('[Usage Reconciliation Sync] Sync failed', toError(error), { requestId });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Trigger sync with custom configuration
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyInternalSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Parse request body
    const body = (await request.json().catch(() => ({}))) as UsageReconciliationSyncRequest;

    // Build custom config
    const config: KvMeteringLogConfig = {
      kvKeyPrefix: 'metering:',
      ttlSeconds: 7 * 24 * 60 * 60,
      batchSize: body.batchSize || 100,
      timeRangeHours: body.timeRangeHours || 24,
    };

    logger.info('[Usage Reconciliation Sync] Starting sync (POST)', {
      requestId,
      timeRangeHours: config.timeRangeHours,
      batchSize: config.batchSize,
    });

    // Trigger sync with custom config
    const syncResult = await syncUsageEventsToKv(config);

    // Get stats
    const stats = await getSyncStats();

    // Log audit event
    await logAuditEvent({
      action: 'usage_reconciliation_sync',
      userId: 'system',
      metadata: {
        requestId,
        config: {
          timeRangeHours: config.timeRangeHours,
          batchSize: config.batchSize,
        },
        eventsScanned: syncResult.eventsScanned,
        eventsSynced: syncResult.eventsSynced,
        eventsSkipped: syncResult.eventsSkipped,
        errors: syncResult.errors.length,
      },
    });

    return NextResponse.json({
      success: syncResult.success,
      sync: {
        eventsScanned: syncResult.eventsScanned,
        eventsSynced: syncResult.eventsSynced,
        eventsSkipped: syncResult.eventsSkipped,
        errors: syncResult.errors,
      },
      stats,
      config: {
        timeRangeHours: config.timeRangeHours,
        batchSize: config.batchSize,
      },
      requestId,
    });
  } catch (error) {
    logger.error('[Usage Reconciliation Sync] Sync failed', toError(error), { requestId });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        requestId,
      },
      { status: 500 }
    );
  }
}
