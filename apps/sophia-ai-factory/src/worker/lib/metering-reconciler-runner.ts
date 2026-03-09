/**
 * Metering Reconciliation Runner (Cron Trigger)
 *
 * Scheduled Cloudflare Worker task that reconciles usage metering logs
 * from KV with the billing system.
 *
 * Flow:
 * 1. Scan 'metering-logs' KV namespace for entries from previous day
 * 2. Aggregate usage by license key and feature
 * 3. Validate licenses via RaaS Gateway /api/license/sync endpoint
 * 4. Push reconciled usage to Stripe/Polar via webhooks
 * 5. Mark processed logs as 'reconciled' in KV
 * 6. Log errors to 'reconciliation-errors' KV namespace
 *
 * Schedule: Daily at 02:00 UTC (0 2 * * *)
 *
 * @module worker/metering-reconciler-runner
 */

import type { Env } from './index';
import type {
  ReconciliationReport,
  ReconciliationConfig,
  ReconciliationResult,
  ReconciliationError,
  Discrepancy,
} from '@/lib/billing/reconciliation-types';
import {
  storeReconciliationReport,
  cleanupOldReports,
} from './r2-report-storage';
import { detectDiscrepancies } from './kv-discrepancy-detector';
import {
  emitDiscrepancyAlerts,
  emitCompletionAlert,
  DEFAULT_ALERT_EMITTER_CONFIG,
} from './reconciliation-alert-emitter';
import { reconcileOverageEvents } from '@/lib/billing/overage-billing-reconciler';
import { syncUsageEventsToKv, getMeteringLogs, markAsReconciled, type MeteringLogEntry } from '@/lib/usage-metering/kv-metering-log-sync';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Default reconciliation configuration for cron trigger
 */
const CRON_RECONCILIATION_CONFIG: ReconciliationConfig = {
  timeRangeHours: 24,
  eventBatchSize: 100,
  kvBatchSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
  r2KeyPrefix: 'reports/reconciliation-',
  retentionDays: 90,
  emitAlerts: true,
};

/**
 * Aggregated usage by license and feature
 */
interface AggregatedUsage {
  licenseNonce: string;
  userId: string;
  service: string;
  totalCredits: number;
  eventCount: number;
  periodStart: number;
  periodEnd: number;
}

/**
 * License validation result from RaaS Gateway
 */
interface LicenseValidationResult {
  valid: boolean;
  tier?: string;
  status?: string;
  error?: string;
}

/**
 * Sentry error tracking (placeholder - integrate with actual Sentry SDK)
 */
async function logErrorToSentry(
  error: Error,
  context: {
    eventId?: string;
    licenseNonce?: string;
    operation: string;
  }
): Promise<void> {
  // Placeholder for Sentry integration
  // In production, use @sentry/worker or Sentry webhook
  logger.error('[Sentry] Error logged', error as Error, {
    eventId: context.eventId,
    licenseNonce: context.licenseNonce,
    operation: context.operation,
  });
}

/**
 * Log error to reconciliation-errors KV namespace
 */
async function logErrorToKv(
  error: Error,
  context: {
    eventId?: string;
    licenseNonce?: string;
    operation: string;
    timestamp: number;
  },
  kv: KVNamespace
): Promise<void> {
  try {
    const errorKey = `reconciliation-errors:${context.timestamp}:${context.licenseNonce || 'unknown'}`;
    const errorEntry = {
      eventId: context.eventId,
      licenseNonce: context.licenseNonce,
      operation: context.operation,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: context.timestamp,
    };
    await kv.put(errorKey, JSON.stringify(errorEntry), { expirationTtl: 7 * 24 * 60 * 60 }); // 7 days
  } catch (logError) {
    logger.error('[Reconciliation Runner] Failed to log error to KV', logError as Error);
  }
}

/**
 * Validate license via RaaS Gateway /api/license/sync endpoint
 */
async function validateLicense(
  licenseNonce: string,
  env: Env
): Promise<LicenseValidationResult> {
  try {
    // Use mk_ API key for RaaS Gateway authentication
    const raasApiKey = env.AGENCYOS_API_KEY;

    if (!raasApiKey) {
      return {
        valid: false,
        error: 'RaaS API key not configured',
      };
    }

    const response = await fetch('https://raas.agencyos.network/api/license/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${raasApiKey}`,
      },
      body: JSON.stringify({ license_nonce: licenseNonce }),
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `RaaS Gateway error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    return {
      valid: data.valid === true || data.status === 'active',
      tier: data.tier,
      status: data.status,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error validating license',
    };
  }
}

/**
 * Aggregate metering logs by license key and feature
 */
function aggregateByLicenseAndFeature(
  logs: Array<{
    licenseNonce: string;
    userId: string;
    service: string;
    creditsUsed: number;
    timestamp: number;
  }>
): Map<string, AggregatedUsage> {
  const aggregated = new Map<string, AggregatedUsage>();

  for (const log of logs) {
    const key = `${log.licenseNonce}:${log.service}`;

    if (!aggregated.has(key)) {
      aggregated.set(key, {
        licenseNonce: log.licenseNonce,
        userId: log.userId,
        service: log.service,
        totalCredits: 0,
        eventCount: 0,
        periodStart: log.timestamp,
        periodEnd: log.timestamp,
      });
    }

    const usage = aggregated.get(key)!;
    usage.totalCredits += log.creditsUsed;
    usage.eventCount++;
    usage.periodStart = Math.min(usage.periodStart, log.timestamp);
    usage.periodEnd = Math.max(usage.periodEnd, log.timestamp);
  }

  return aggregated;
}

/**
 * Get metering logs from KV namespace for time range
 * Wrapper around getMeteringLogs with proper typing for Worker
 */
async function getMeteringLogsFromKv(
  startTime: number,
  endTime: number
): Promise<MeteringLogEntry[]> {
  // getMeteringLogs already handles DB fallback when KV is not efficient
  return getMeteringLogs(startTime, endTime);
}

/**
 * Main reconciliation runner for cron trigger
 *
 * Called by scheduled handler in worker/index.ts
 */
export async function runMeteringReconciliation(
  env: Env,
  ctx: ExecutionContext,
  config: ReconciliationConfig = CRON_RECONCILIATION_CONFIG
): Promise<ReconciliationResult> {
  const report: ReconciliationReport = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    periodStart: Math.floor((Date.now() - config.timeRangeHours * 60 * 60 * 1000) / 1000),
    periodEnd: Math.floor(Date.now() / 1000),
    unbilledEventsScanned: 0,
    kvMeteringLogsScanned: 0,
    invoicesCreated: 0,
    totalAmount: 0,
    currency: 'USD',
    discrepancies: [],
    errors: [],
    r2StorageKey: '',
    cronSchedule: '0 2 * * *',
    workerVersion: '1.0.0',
  };

  let alertsEmitted = 0;
  let retriesPerformed = 0;
  let licensesValidated = 0;
  let logsMarkedReconciled = 0;
  let errorsLoggedToKv = 0;

  try {
    logger.info('[Reconciliation Runner] Starting daily reconciliation', {
      reportId: report.id,
      timeRangeHours: config.timeRangeHours,
    });

    // Step 1: Sync usage events to KV (if not already synced)
    logger.info('[Reconciliation Runner] Syncing usage events to KV');
    const syncResult = await syncUsageEventsToKv({
      kvKeyPrefix: 'metering:',
      ttlSeconds: config.retentionDays * 24 * 60 * 60,
      batchSize: config.kvBatchSize,
      timeRangeHours: config.timeRangeHours,
    });

    report.kvMeteringLogsScanned = syncResult.eventsScanned;

    if (!syncResult.success) {
      report.errors.push({
        type: 'scanning',
        message: 'KV sync failed',
        details: { errors: syncResult.errors },
        retryable: true,
        timestamp: Date.now(),
      });
    }

    // Step 2: Scan KV 'metering-logs' namespace for previous day entries
    logger.info('[Reconciliation Runner] Scanning KV metering-logs namespace');
    const startTime = report.periodStart;
    const endTime = report.periodEnd;

    const meteringLogs = await getMeteringLogsFromKv(startTime, endTime);
    report.unbilledEventsScanned = meteringLogs.length;

    if (meteringLogs.length === 0) {
      logger.info('[Reconciliation Runner] No metering logs found in KV');
    } else {
      logger.info('[Reconciliation Runner] Found metering logs', {
        count: meteringLogs.length,
      });
    }

    // Step 3: Aggregate usage by license key and feature
    logger.info('[Reconciliation Runner] Aggregating usage by license and feature');
    const aggregated = aggregateByLicenseAndFeature(
      meteringLogs.map(log => ({
        licenseNonce: log.licenseNonce,
        userId: log.userId,
        service: log.service,
        creditsUsed: log.creditsUsed,
        timestamp: log.timestamp,
      }))
    );

    logger.info('[Reconciliation Runner] Aggregated usage', {
      uniqueLicenseServicePairs: aggregated.size,
    });

    // Step 4: Validate licenses via RaaS Gateway
    logger.info('[Reconciliation Runner] Validating licenses via RaaS Gateway');
    const validatedLicenses = new Map<string, LicenseValidationResult>();

    for (const [key, usage] of aggregated) {
      const validation = await validateLicense(usage.licenseNonce, env);
      validatedLicenses.set(key, validation);
      licensesValidated++;

      if (!validation.valid) {
        logger.warn('[Reconciliation Runner] License validation failed', {
          licenseNonce: usage.licenseNonce.slice(0, 8),
          service: usage.service,
          error: validation.error,
        });

        // Log to reconciliation-errors KV
        await logErrorToKv(
          new Error(`License validation failed: ${validation.error}`),
          {
            licenseNonce: usage.licenseNonce,
            operation: 'license_validation',
            timestamp: Date.now(),
          },
          env.KV_KV
        );
        errorsLoggedToKv++;

        report.discrepancies.push({
          type: 'gateway_discrepancy',
          severity: 'high',
          licenseNonce: usage.licenseNonce,
          userId: usage.userId,
          details: {
            description: validation.error || 'License validation failed',
            source: 'raas_gateway',
          },
          timestamp: Date.now(),
        });
      }
    }

    // Step 5: Reconcile overage events with billing system
    logger.info('[Reconciliation Runner] Running billing reconciliation');
    const billingResult = await reconcileOverageEvents();

    report.unbilledEventsScanned = billingResult.scannedEvents;
    report.invoicesCreated = billingResult.invoiceItemsCreated;
    report.totalAmount = billingResult.totalCharge;

    if (!billingResult.success) {
      billingResult.errors.forEach((err) => {
        report.errors.push({
          type: 'billing',
          message: err.message,
          details: err.details as Record<string, unknown>,
          retryable: err.retryable,
          timestamp: Date.now(),
        });

        // Log to Sentry for retryable errors
        if (err.retryable) {
          retriesPerformed++;
          ctx.waitUntil(
            logErrorToSentry(new Error(err.message), {
              operation: 'billing_reconciliation',
            })
          );
        }
      });
    }

    // Step 6: Mark processed logs as reconciled in KV
    logger.info('[Reconciliation Runner] Marking logs as reconciled');
    for (const log of meteringLogs) {
      const key = `${log.licenseNonce}:${log.service}`;
      const validation = validatedLicenses.get(key);

      // Only mark as reconciled if license is valid
      if (validation?.valid) {
        const success = await markAsReconciled(log.eventId, log.timestamp);
        if (success) {
          logsMarkedReconciled++;
        }
      }
    }

    logger.info('[Reconciliation Runner] Logs marked as reconciled', {
      count: logsMarkedReconciled,
    });

    // Step 7: Detect discrepancies between KV and DB
    logger.info('[Reconciliation Runner] Detecting discrepancies');
    const discrepancies: Discrepancy[] = detectDiscrepancies([], meteringLogs);
    report.discrepancies = [...report.discrepancies, ...discrepancies];

    // Step 8: Emit alerts for discrepancies
    if (config.emitAlerts && discrepancies.length > 0) {
      logger.info('[Reconciliation Runner] Emitting discrepancy alerts');
      alertsEmitted = await emitDiscrepancyAlerts(discrepancies, {
        ...DEFAULT_ALERT_EMITTER_CONFIG,
        apiKey: env.AGENCYOS_API_KEY,
        alertsEndpoint: env.AGENCYOS_ALERT_WEBHOOK_URL,
      });
    }

    // Step 9: Store report in R2
    logger.info('[Reconciliation Runner] Storing report in R2');
    report.r2StorageKey = await storeReconciliationReport(
      report,
      env.R2_BUCKET,
      config.r2KeyPrefix
    );

    // Step 10: Emit completion alert
    if (config.emitAlerts) {
      ctx.waitUntil(
        emitCompletionAlert(report.r2StorageKey, 'system', {
          ...DEFAULT_ALERT_EMITTER_CONFIG,
          apiKey: env.AGENCYOS_API_KEY,
        })
      );
    }

    // Step 11: Cleanup old reports (retention policy)
    ctx.waitUntil(cleanupOldReports(env.R2_BUCKET, config.retentionDays));

    logger.info('[Reconciliation Runner] Reconciliation complete', {
      reportId: report.id,
      totalAmount: report.totalAmount,
      invoicesCreated: report.invoicesCreated,
      licensesValidated,
      logsMarkedReconciled,
      errorsLoggedToKv,
      discrepancies: report.discrepancies.length,
      errors: report.errors.length,
    });

    return {
      success: report.errors.length === 0,
      report,
      alertsEmitted,
      retriesPerformed,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('[Reconciliation Runner] Reconciliation failed', err);

    report.errors.push({
      type: 'scanning',
      message: `Reconciliation failed: ${err.message}`,
      details: { stack: err.stack },
      retryable: true,
      timestamp: Date.now(),
    });

    // Log to Sentry
    ctx.waitUntil(
      logErrorToSentry(err, {
        operation: 'metering_reconciliation',
      })
    );

    // Log to KV
    await logErrorToKv(err, {
      operation: 'reconciliation_runner',
      timestamp: Date.now(),
    }, env.KV_KV);

    return {
      success: false,
      report,
      alertsEmitted,
      retriesPerformed,
    };
  }
}
