/**
 * Metering Reconciliation Finalize Step Executors (Steps 4, 6, 7)
 * @module forest/worker/lib/metering-reconciler-finalize-steps
 */

import { detectDiscrepancies } from './kv-discrepancy-detector';
import { logger } from '@/seed/utils/logger-utility';
import {
  aggregateByLicenseAndFeature,
  markReconciledLogs,
} from './metering-reconciler-aggregator';
import { validateAllLicenses } from './metering-reconciler-license-validator';
import type { MeteringLog, StepContext } from './metering-reconciler-steps';

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
  _ctx: StepContext
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
