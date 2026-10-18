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
import { withFinanceAdminDb } from './with-finance-admin-db';

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
  return withFinanceAdminDb((db, auth) =>
    executeInitiatePeriodClose(db, periodKey, periodType, auth.userId, startDateStr, endDateStr),
  );
}

export async function finalizeFinancialCloseAction(
  periodKey: string,
): Promise<Result<FinalizePeriodResult, FinancialCloseActionError>> {
  return withFinanceAdminDb((db, auth) =>
    executeFinalizePeriodClose(db, periodKey, auth.userId),
  );
}

export async function lockFinancialPeriodAction(
  periodKey: string,
  lockReason: string,
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  return withFinanceAdminDb((db, auth) =>
    executeLockPeriod(db, periodKey, lockReason, auth.userId),
  );
}

export async function reopenFinancialPeriodAction(
  periodKey: string,
  reason: string,
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  return withFinanceAdminDb((db, auth) =>
    executeReopenPeriod(db, periodKey, reason, auth.userId),
  );
}

export async function recordIntercompanyTransferAction(
  input: RecordTransferInput,
): Promise<Result<IntercompanyTransfer, FinancialCloseActionError>> {
  return withFinanceAdminDb((db, auth) =>
    executeRecordTransfer(db, input, auth.userId),
  );
}

export async function reconcileIntercompanyTransferAction(
  transferId: string,
  notes?: string,
): Promise<Result<IntercompanyTransfer, FinancialCloseActionError>> {
  return withFinanceAdminDb((db, auth) =>
    executeReconcileTransfer(db, transferId, auth.userId, notes),
  );
}

export async function verifyAuditVaultIntegrityAction(
  periodKey?: string,
): Promise<Result<LedgerIntegrityResult, FinancialCloseActionError>> {
  return withFinanceAdminDb((db) => executeVerifyAuditVaultIntegrity(db, periodKey));
}

export async function exportFormS1AuditReportAction(
  periodKey: string,
): Promise<Result<FormS1AuditPack, FinancialCloseActionError>> {
  return withFinanceAdminDb((db) => executeExportFormS1AuditReport(db, periodKey));
}

export async function getFinancialPeriodStatusAction(
  periodKey: string,
): Promise<Result<FinancialClosePeriod | null, FinancialCloseActionError>> {
  return withFinanceAdminDb((db) => executeGetPeriodStatus(db, periodKey));
}
