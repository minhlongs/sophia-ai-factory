'use server';

/**
 * Enterprise Financial Close & IPO Audit Vault Server Actions
 * Layer: land/finance/close
 *
 * @module land/finance/close/financial-close-actions
 */

import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  FinancialClosePeriod,
  RevenueSchedule,
  IntercompanyTransfer,
  PeriodType,
  CreateScheduleInput,
  RecordTransferInput,
  AccrualRunResult,
  FinalizePeriodResult,
  LedgerIntegrityResult,
  FormS1AuditPack,
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
  executeVerifyAuditVaultIntegrity,
  executeExportFormS1AuditReport,
} from './reconciliation-checker';
import {
  executeInitiatePeriodClose,
  executeFinalizePeriodClose,
  executeLockPeriod,
  executeReopenPeriod,
  executeRecordTransfer,
  executeReconcileTransfer,
  executeGetPeriodStatus,
} from './period-closer';

export async function createRevenueScheduleAction(
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

export async function runDailyAccrualAction(
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

export async function initiateFinancialCloseAction(
  periodKey: string,
  periodType: PeriodType,
  startDateStr?: string,
  endDateStr?: string,
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeInitiatePeriodClose(dbRes.value, periodKey, periodType, authRes.value.userId, startDateStr, endDateStr);
}

export async function finalizeFinancialCloseAction(
  periodKey: string,
): Promise<Result<FinalizePeriodResult, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeFinalizePeriodClose(dbRes.value, periodKey, authRes.value.userId);
}

export async function lockFinancialPeriodAction(
  periodKey: string,
  lockReason: string,
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeLockPeriod(dbRes.value, periodKey, lockReason, authRes.value.userId);
}

export async function reopenFinancialPeriodAction(
  periodKey: string,
  reason: string,
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeReopenPeriod(dbRes.value, periodKey, reason, authRes.value.userId);
}

export async function recordIntercompanyTransferAction(
  input: RecordTransferInput,
): Promise<Result<IntercompanyTransfer, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeRecordTransfer(dbRes.value, input, authRes.value.userId);
}

export async function reconcileIntercompanyTransferAction(
  transferId: string,
  notes?: string,
): Promise<Result<IntercompanyTransfer, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeReconcileTransfer(dbRes.value, transferId, authRes.value.userId, notes);
}

export async function verifyAuditVaultIntegrityAction(
  periodKey?: string,
): Promise<Result<LedgerIntegrityResult, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeVerifyAuditVaultIntegrity(dbRes.value, periodKey);
}

export async function exportFormS1AuditReportAction(
  periodKey: string,
): Promise<Result<FormS1AuditPack, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeExportFormS1AuditReport(dbRes.value, periodKey);
}

export async function getFinancialPeriodStatusAction(
  periodKey: string,
): Promise<Result<FinancialClosePeriod | null, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeGetPeriodStatus(dbRes.value, periodKey);
}
