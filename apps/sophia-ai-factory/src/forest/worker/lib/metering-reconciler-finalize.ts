/**
 * Post-Step Finalization Helpers (R2 storage, alerting, and report initialization)
 * for Metering Reconciliation Runner.
 * @module worker/metering-reconciler-finalize
 */

import type { Env } from '../index';
import type {
  Discrepancy,
  ReconciliationReport,
  ReconciliationConfig,
} from '@/seed/types/billing-contracts';
import {
  storeReconciliationReport,
  cleanupOldReports,
} from './r2-report-storage';
import {
  emitDiscrepancyAlerts,
  emitCompletionAlert,
  DEFAULT_ALERT_EMITTER_CONFIG,
} from './reconciliation-alert-emitter';
import { logger } from '@/seed/utils/logger-utility';

export function createInitialReconciliationReport(config: ReconciliationConfig): ReconciliationReport {
  return {
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
}

export async function finalizeReconciliationRun(params: {
  report: ReconciliationReport;
  discrepancies: Discrepancy[];
  config: ReconciliationConfig;
  env: Env;
  ctx: ExecutionContext;
}): Promise<number> {
  const { report, discrepancies, config, env, ctx } = params;
  let alertsEmitted = 0;

  // Step 8: Emit alerts for discrepancies
  if (config.emitAlerts && discrepancies.length > 0) {
    logger.info('[Reconciliation Runner] Emitting discrepancy alerts');
    alertsEmitted = await emitDiscrepancyAlerts(discrepancies, {
      ...DEFAULT_ALERT_EMITTER_CONFIG,
      apiKey: env.AGENCYOS_API_KEY as string,
      alertsEndpoint: env.AGENCYOS_ALERT_WEBHOOK_URL as string,
    });
  }

  // Step 9: Store report in R2
  logger.info('[Reconciliation Runner] Storing report in R2');
  report.r2StorageKey = await storeReconciliationReport(
    report,
    env.R2_BUCKET as R2Bucket,
    config.r2KeyPrefix,
  );

  // Step 10: Emit completion alert
  if (config.emitAlerts) {
    ctx.waitUntil(
      emitCompletionAlert(report.r2StorageKey, 'system', {
        ...DEFAULT_ALERT_EMITTER_CONFIG,
        apiKey: env.AGENCYOS_API_KEY as string,
      }),
    );
  }

  // Step 11: Cleanup old reports
  ctx.waitUntil(cleanupOldReports(env.R2_BUCKET as R2Bucket, config.retentionDays));

  return alertsEmitted;
}
