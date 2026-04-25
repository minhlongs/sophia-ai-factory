/**
 * Metering Reconciliation Runner (Cron Trigger)
 *
 * Scheduled Cloudflare Worker task that reconciles usage metering logs
 * from KV with the billing system.
 *
 * Sub-modules:
 *   metering-reconciler-types.ts            — AggregatedUsage, LicenseValidationResult, CRON_RECONCILIATION_CONFIG
 *   metering-reconciler-error-logger.ts     — logErrorToSentry, logErrorToKv
 *   metering-reconciler-license-validator.ts — validateLicense, validateAllLicenses
 *   metering-reconciler-aggregator.ts       — aggregateByLicenseAndFeature, getMeteringLogsFromKv, markReconciledLogs
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
import { syncUsageEventsToKv } from '@/lib/usage-metering/kv-metering-log-sync';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import { CRON_RECONCILIATION_CONFIG } from './metering-reconciler-types';
import { logErrorToSentry, logErrorToKv } from './metering-reconciler-error-logger';
import { validateAllLicenses } from './metering-reconciler-license-validator';
import {
  aggregateByLicenseAndFeature,
  getMeteringLogsFromKv,
  markReconciledLogs,
} from './metering-reconciler-aggregator';

export { CRON_RECONCILIATION_CONFIG } from './metering-reconciler-types';
export type { AggregatedUsage, LicenseValidationResult } from './metering-reconciler-types';
export { logErrorToSentry, logErrorToKv } from './metering-reconciler-error-logger';
export { validateLicense, validateAllLicenses } from './metering-reconciler-license-validator';
export {
  aggregateByLicenseAndFeature,
  getMeteringLogsFromKv,
  markReconciledLogs,
} from './metering-reconciler-aggregator';

/**
 * Main reconciliation runner for cron trigger.
 *
 * Flow:
 * 1. Sync usage events to KV
 * 2. Scan KV metering-logs namespace for time range
 * 3. Aggregate usage by license + feature
 * 4. Validate licenses via RaaS Gateway
 * 5. Billing reconciliation skipped (NOWPayments IPN handles payments)
 * 6. Mark processed logs as reconciled
 * 7. Detect discrepancies between KV and DB
 * 8. Emit alerts for discrepancies
 * 9. Store report in R2
 * 10. Emit completion alert
 * 11. Cleanup old reports (retention policy)
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
    const meteringLogs = await getMeteringLogsFromKv(report.periodStart, report.periodEnd);
    report.unbilledEventsScanned = meteringLogs.length;

    if (meteringLogs.length === 0) {
      logger.info('[Reconciliation Runner] No metering logs found in KV');
    } else {
      logger.info('[Reconciliation Runner] Found metering logs', { count: meteringLogs.length });
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
    const {
      validatedLicenses,
      licensesValidated,
      errorsLoggedToKv,
      discrepancies: validationDiscrepancies,
    } = await validateAllLicenses(aggregated, env);

    report.discrepancies.push(...validationDiscrepancies);

    logger.info('[Reconciliation Runner] Licenses validated', {
      licensesValidated,
      errorsLoggedToKv,
      validationDiscrepancies: validationDiscrepancies.length,
    });

    // Step 5: Billing reconciliation skipped — NOWPayments handles payments via IPN
    logger.info('[Reconciliation Runner] Billing reconciliation skipped (NOWPayments IPN)');
    report.unbilledEventsScanned = 0;
    report.invoicesCreated = 0;
    report.totalAmount = 0;

    if (false) {
      // Placeholder to preserve report error structure
      const billingErrors: Array<{ message: string; details: unknown; retryable: boolean }> = [];
      billingErrors.forEach((err) => {
        report.errors.push({
          type: 'billing',
          message: err.message,
          details: err.details as Record<string, unknown>,
          retryable: err.retryable,
          timestamp: Date.now(),
        });

        if (err.retryable) {
          retriesPerformed++;
          ctx.waitUntil(
            logErrorToSentry(new Error(err.message), { operation: 'billing_reconciliation' })
          );
        }
      });
    }

    // Step 6: Mark processed logs as reconciled in KV
    logger.info('[Reconciliation Runner] Marking logs as reconciled');
    const logsMarkedReconciled = await markReconciledLogs(meteringLogs, validatedLicenses);

    logger.info('[Reconciliation Runner] Logs marked as reconciled', {
      count: logsMarkedReconciled,
    });

    // Step 7: Detect discrepancies between KV and DB
    logger.info('[Reconciliation Runner] Detecting discrepancies');
    const discrepancies = detectDiscrepancies([], meteringLogs);
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
    const err = toError(error);
    logger.error('[Reconciliation Runner] Reconciliation failed', err);

    report.errors.push({
      type: 'scanning',
      message: `Reconciliation failed: ${err.message}`,
      details: { stack: err.stack },
      retryable: true,
      timestamp: Date.now(),
    });

    ctx.waitUntil(
      logErrorToSentry(err, { operation: 'metering_reconciliation' })
    );

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
