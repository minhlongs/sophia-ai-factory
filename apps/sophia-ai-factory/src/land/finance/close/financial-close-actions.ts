'use server';

/**
 * Enterprise Financial Close & IPO Audit Vault Server Actions
 * Layer: land/finance/close
 *
 * @module land/finance/close/financial-close-actions
 */

import type { Result } from '@/seed/types/result';
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
import type { FinancialCloseActionError } from './types';
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
import {
  executeCreateRevenueSchedule,
  executeRunDailyAccrual,
} from './revenue-schedule-runner';

export async function createRevenueScheduleAction(
  input: CreateScheduleInput,
): Promise<Result<RevenueSchedule, FinancialCloseActionError>> {
  return executeCreateRevenueSchedule(input);
}

export async function runDailyAccrualAction(
  targetDate?: string,
): Promise<Result<AccrualRunResult, FinancialCloseActionError>> {
  return executeRunDailyAccrual(targetDate);
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

export async function verifyAuditVaultIntegrityAction(periodKey?: string): Promise<Result<LedgerIntegrityResult, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeVerifyAuditVaultIntegrity(dbRes.value, periodKey);
}

export async function exportFormS1AuditReportAction(periodKey: string): Promise<Result<FormS1AuditPack, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeExportFormS1AuditReport(dbRes.value, periodKey);
}

export async function getFinancialPeriodStatusAction(periodKey: string): Promise<Result<FinancialClosePeriod | null, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return executeGetPeriodStatus(dbRes.value, periodKey);
}
