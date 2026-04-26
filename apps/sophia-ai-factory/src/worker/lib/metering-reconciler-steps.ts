/**
 * Metering Reconciliation Step Executors
 *
 * Individual step functions for the metering reconciliation pipeline.
 * Separated from the runner to keep the runner under 200 lines.
 *
 * Steps:
 *   runSyncStep          — Step 1: Sync usage events to KV
 *   runScanStep          — Step 2: Scan KV metering-logs namespace
 *   runAggregateStep     — Step 3: Aggregate usage by license + feature
 *   runValidateStep      — Step 4: Validate licenses via RaaS Gateway
 *   runMarkReconciledStep— Step 6: Mark processed logs as reconciled
 *   runDiscrepancyStep   — Step 7: Detect discrepancies
 */

import type { Env } from '../index';
import type { ReconciliationReport, ReconciliationConfig } from '@/lib/billing/reconciliation-types';
import { detectDiscrepancies } from './kv-discrepancy-detector';
import { syncUsageEventsToKv } from '@/lib/usage-metering/kv-metering-log-sync';
import { logger } from '@/lib/utils/logger-utility';
import {
  aggregateByLicenseAndFeature,
  getMeteringLogsFromKv,
  markReconciledLogs,
} from './metering-reconciler-aggregator';
import { validateAllLicenses } from './metering-reconciler-license-validator';

export type MeteringLog = Awaited<ReturnType<typeof getMeteringLogsFromKv>>[number];

export interface StepContext {
  report: ReconciliationReport;
  config: ReconciliationConfig;
  env: Env;
}

/**
 * Step 1: Sync usage events to KV
 */
export async function runSyncStep(ctx: StepContext): Promise<void> {
  logger.info('[Reconciliation Runner] Syncing usage events to KV');
  const syncResult = await syncUsageEventsToKv({
    kvKeyPrefix: 'metering:',
    ttlSeconds: ctx.config.retentionDays * 24 * 60 * 60,
    batchSize: ctx.config.kvBatchSize,
    timeRangeHours: ctx.config.timeRangeHours,
  });

  ctx.report.kvMeteringLogsScanned = syncResult.eventsScanned;

  if (!syncResult.success) {
    ctx.report.errors.push({
      type: 'scanning',
      message: 'KV sync failed',
      details: { errors: syncResult.errors },
      retryable: true,
      timestamp: Date.now(),
    });
  }
}

/**
 * Step 2: Scan KV metering-logs namespace for time range
 */
export async function runScanStep(ctx: StepContext): Promise<MeteringLog[]> {
  logger.info('[Reconciliation Runner] Scanning KV metering-logs namespace');
  const meteringLogs = await getMeteringLogsFromKv(ctx.report.periodStart, ctx.report.periodEnd);
  ctx.report.unbilledEventsScanned = meteringLogs.length;

  if (meteringLogs.length === 0) {
    logger.info('[Reconciliation Runner] No metering logs found in KV');
  } else {
    logger.info('[Reconciliation Runner] Found metering logs', { count: meteringLogs.length });
  }

  return meteringLogs;
}

/**
 * Step 3: Aggregate usage by license key and feature
 */
export function runAggregateStep(meteringLogs: MeteringLog[]): ReturnType<typeof aggregateByLicenseAndFeature> {
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

  return aggregated;
}

/**
 * Step 4: Validate licenses via RaaS Gateway
 */
export async function runValidateStep(
  aggregated: ReturnType<typeof aggregateByLicenseAndFeature>,
  ctx: StepContext
) {
  logger.info('[Reconciliation Runner] Validating licenses via RaaS Gateway');
  const result = await validateAllLicenses(aggregated, ctx.env);

  ctx.report.discrepancies.push(...result.discrepancies);

  logger.info('[Reconciliation Runner] Licenses validated', {
    licensesValidated: result.licensesValidated,
    errorsLoggedToKv: result.errorsLoggedToKv,
    validationDiscrepancies: result.discrepancies.length,
  });

  return result;
}

/**
 * Step 6: Mark processed logs as reconciled in KV
 */
export async function runMarkReconciledStep(
  meteringLogs: MeteringLog[],
  validatedLicenses: Awaited<ReturnType<typeof validateAllLicenses>>['validatedLicenses'],
  ctx: StepContext
): Promise<number> {
  logger.info('[Reconciliation Runner] Marking logs as reconciled');
  const count = await markReconciledLogs(meteringLogs, validatedLicenses);
  logger.info('[Reconciliation Runner] Logs marked as reconciled', { count });
  return count;
}

/**
 * Step 7: Detect discrepancies between KV and DB
 */
export function runDiscrepancyStep(
  meteringLogs: MeteringLog[],
  ctx: StepContext
): ReturnType<typeof detectDiscrepancies> {
  logger.info('[Reconciliation Runner] Detecting discrepancies');
  const discrepancies = detectDiscrepancies([], meteringLogs);
  ctx.report.discrepancies = [...ctx.report.discrepancies, ...discrepancies];
  return discrepancies;
}
