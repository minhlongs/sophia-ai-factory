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
 *   metering-reconciler-steps.ts            — individual step executors (Steps 1-7)
 *
 * Schedule: Daily at 02:00 UTC (0 2 * * *)
 *
 * @module worker/metering-reconciler-runner
 */

import type { Env } from '../index';
import type {
  ReconciliationConfig,
  ReconciliationResult,
} from '@/seed/types/billing-contracts';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { CRON_RECONCILIATION_CONFIG } from './metering-reconciler-types';
import { logErrorToSentry, logErrorToKv } from './metering-reconciler-error-logger';
import {
  runSyncStep,
  runScanStep,
  runAggregateStep,
  runValidateStep,
  runMarkReconciledStep,
  runDiscrepancyStep,
} from './metering-reconciler-steps';
import {
  createInitialReconciliationReport,
  finalizeReconciliationRun,
} from './metering-reconciler-finalize';

// Re-exports for consumers of this module
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
  const report = createInitialReconciliationReport(config);
  const stepCtx = { report, config, env };
  let alertsEmitted = 0;
  const retriesPerformed = 0;

  try {
    logger.info('[Reconciliation Runner] Starting daily reconciliation', {
      reportId: report.id,
      timeRangeHours: config.timeRangeHours,
    });

    // Steps 1–7: delegated to metering-reconciler-steps.ts
    await runSyncStep(stepCtx);
    const meteringLogs = await runScanStep(stepCtx);
    const aggregated = runAggregateStep(meteringLogs);
    const { validatedLicenses, licensesValidated, errorsLoggedToKv } =
      await runValidateStep(aggregated, stepCtx);

    // Step 5: Billing reconciliation skipped — NOWPayments handles via IPN
    logger.info('[Reconciliation Runner] Billing reconciliation skipped (NOWPayments IPN)');
    report.unbilledEventsScanned = 0;
    report.invoicesCreated = 0;
    report.totalAmount = 0;

    const logsMarkedReconciled = await runMarkReconciledStep(meteringLogs, validatedLicenses, stepCtx);
    const discrepancies = runDiscrepancyStep(meteringLogs, stepCtx);

    alertsEmitted = await finalizeReconciliationRun({
      report,
      discrepancies,
      config,
      env,
      ctx,
    });

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
