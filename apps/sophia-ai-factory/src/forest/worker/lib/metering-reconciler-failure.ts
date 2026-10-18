/**
 * Metering Reconciliation Failure Handler
 *
 * Records fatal reconciliation runner errors in report, Sentry, and KV.
 *
 * @module worker/metering-reconciler-failure
 */

import type { Env } from '../index';
import type {
  ReconciliationReport,
  ReconciliationResult,
} from '@/seed/types/billing-contracts';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { logErrorToSentry, logErrorToKv } from './metering-reconciler-error-logger';

export async function handleReconciliationFailure(params: {
  error: unknown;
  report: ReconciliationReport;
  alertsEmitted: number;
  retriesPerformed: number;
  env: Env;
  ctx: ExecutionContext;
}): Promise<ReconciliationResult> {
  const { error, report, alertsEmitted, retriesPerformed, env, ctx } = params;
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

  await logErrorToKv(
    err,
    {
      operation: 'reconciliation_runner',
      timestamp: Date.now(),
    },
    env.KV_KV
  );

  return {
    success: false,
    report,
    alertsEmitted,
    retriesPerformed,
  };
}
