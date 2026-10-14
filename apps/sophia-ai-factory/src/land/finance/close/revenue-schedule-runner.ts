/**
 * Revenue Schedule & Daily Accrual Execution Helpers
 * Layer: land/finance/close
 *
 * @module land/finance/close/revenue-schedule-runner
 */

import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  RevenueSchedule,
  CreateScheduleInput,
  AccrualRunResult,
} from '@/seed/types/financial-close';
import {
  createRevenueSchedule,
  processDailyAccrual,
  formatDateIso,
} from '@/tree/finance/revenue-recognition-engine';
import { type FinancialCloseActionError, normalizeErrorArg } from './types';
import {
  assertFinanceAdminAccess,
  resolveDb,
} from './reconciliation-checker';

export async function executeCreateRevenueSchedule(
  input: CreateScheduleInput,
): Promise<Result<RevenueSchedule, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const schedule = await createRevenueSchedule(dbRes.value, input);
    logger.info(`Created revenue schedule ${schedule.id} for contract ${schedule.contractId}`);
    return success(schedule);
  } catch (err) {
    logger.error('Failed to create revenue schedule', normalizeErrorArg(err));
    return failure({
      code: 'SCHEDULE_CREATION_FAILED',
      message: err instanceof Error ? err.message : 'Unknown revenue schedule creation error',
    });
  }
}

export async function executeRunDailyAccrual(
  targetDate?: string,
): Promise<Result<AccrualRunResult, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const asOf = targetDate ?? formatDateIso(new Date());
    const result = await processDailyAccrual(dbRes.value, asOf);
    logger.info(`Processed daily accrual for ${asOf}: ${result.schedulesAccrued} accrued, ${result.totalAccruedCents} cents recognized`);
    return success(result);
  } catch (err) {
    logger.error('Failed to process daily accrual', normalizeErrorArg(err));
    return failure({
      code: 'DAILY_ACCRUAL_FAILED',
      message: err instanceof Error ? err.message : 'Unknown accrual processing error',
    });
  }
}
