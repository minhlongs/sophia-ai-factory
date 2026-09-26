/**
 * Enterprise Financial Close & IPO Audit Vault Server Actions
 *
 * Implements authenticated server mutations and queries for:
 * - ASC 606 revenue schedule creation and daily accrual batch runs
 * - Multi-stage period close lifecycle (open -> closing -> closed -> locked -> audited)
 * - Intercompany transfer pricing, withholding tax, and VAS TT200 reconciliation
 * - Cryptographic SHA-256 Merkle audit vault validation and SEC Form S-1 reporting
 *
 * Layer: land (Public business layer & server actions)
 * Dependencies: @/seed/*, @/tree/finance/* (Never imports @/forest)
 *
 * @module land/finance/financial-close-actions
 */

'use server';

import type { D1Database } from '@cloudflare/workers-types';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
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
import {
  initiatePeriodClose,
  finalizePeriodClose,
  lockPeriod,
  reopenPeriod,
  getPeriodStatus,
  recordIntercompanyTransfer,
  reconcileIntercompanyTransfer,
} from '@/tree/finance/financial-close-orchestrator';
import {
  verifyAuditLedgerChain,
  generateFormS1AuditPack,
} from '@/tree/finance/merkle-audit-vault';

export interface FinancialCloseActionError {
  code: string;
  message: string;
}

interface AuthContext {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
}

function normalizeErrorArg(err: unknown): Error | Record<string, unknown> {
  if (err instanceof Error) return err;
  return { error: String(err) };
}

/**
 * Authentication and administrative authorization gate for financial operations
 */
async function assertFinanceAdminAccess(): Promise<Result<AuthContext, FinancialCloseActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { isAdmin } = await isUserAdminWithRole(user);
    if (!isAdmin && user.role !== 'admin') {
      return failure({
        code: 'FORBIDDEN',
        message: 'Financial close operations require CFO, Controller, or Platform Admin privileges.',
      });
    }

    return success({ userId: user.id, userEmail: user.email, isAdmin: true });
  } catch (err) {
    logger.error('Finance auth assertion error', normalizeErrorArg(err));
    return failure({ code: 'AUTH_ERROR', message: 'Failed to verify administrative authorization' });
  }
}

async function resolveDb(): Promise<Result<D1Database, FinancialCloseActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({
      code: 'DATABASE_UNAVAILABLE',
      message: 'D1 Database binding is currently unavailable.',
    });
  }
  return success(db);
}

/**
 * Create a new ASC 606 revenue schedule for a subscription contract
 */
export async function createRevenueScheduleAction(
  input: CreateScheduleInput
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

/**
 * Execute daily ASC 606 ratable accruals across all active schedules
 */
export async function runDailyAccrualAction(
  targetDate?: string
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

/**
 * Initiate pre-close audit for an accounting period
 */
export async function initiateFinancialCloseAction(
  periodKey: string,
  periodType: PeriodType,
  startDateStr?: string,
  endDateStr?: string
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const period = await initiatePeriodClose(
      dbRes.value,
      periodKey,
      periodType,
      authRes.value.userId,
      null,
      startDateStr,
      endDateStr
    );
    return success(period);
  } catch (err) {
    logger.error(`Failed to initiate close for ${periodKey}`, normalizeErrorArg(err));
    return failure({
      code: 'INITIATE_CLOSE_FAILED',
      message: err instanceof Error ? err.message : 'Failed to initiate financial close period',
    });
  }
}

/**
 * Finalize financial close, computing revenue totals and anchoring Merkle root hash
 */
export async function finalizeFinancialCloseAction(
  periodKey: string
): Promise<Result<FinalizePeriodResult, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const result = await finalizePeriodClose(dbRes.value, periodKey, authRes.value.userId);
    logger.info(`Finalized financial close for ${periodKey}, Merkle root: ${result.merkleRootHash}`);
    return success(result);
  } catch (err) {
    logger.error(`Failed to finalize close for ${periodKey}`, normalizeErrorArg(err));
    return failure({
      code: 'FINALIZE_CLOSE_FAILED',
      message: err instanceof Error ? err.message : 'Failed to finalize financial close period',
    });
  }
}

/**
 * Permanently lock an accounting period for SOX 404 / SEC Form S-1 immutability
 */
export async function lockFinancialPeriodAction(
  periodKey: string,
  lockReason: string
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const locked = await lockPeriod(dbRes.value, periodKey, lockReason, authRes.value.userId);
    logger.info(`Permanently locked period ${periodKey}: ${lockReason}`);
    return success(locked);
  } catch (err) {
    logger.error(`Failed to lock period ${periodKey}`, normalizeErrorArg(err));
    return failure({
      code: 'LOCK_PERIOD_FAILED',
      message: err instanceof Error ? err.message : 'Failed to lock financial period',
    });
  }
}

/**
 * Reopen a closed period (fails if period is locked or audited)
 */
export async function reopenFinancialPeriodAction(
  periodKey: string,
  reason: string
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const reopened = await reopenPeriod(dbRes.value, periodKey, reason, authRes.value.userId);
    return success(reopened);
  } catch (err) {
    logger.error(`Failed to reopen period ${periodKey}`, normalizeErrorArg(err));
    return failure({
      code: 'REOPEN_PERIOD_FAILED',
      message: err instanceof Error ? err.message : 'Failed to reopen financial period',
    });
  }
}

/**
 * Record a cross-border intercompany transfer with statutory withholding tax
 */
export async function recordIntercompanyTransferAction(
  input: RecordTransferInput
): Promise<Result<IntercompanyTransfer, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const transfer = await recordIntercompanyTransfer(dbRes.value, input, authRes.value.userId);
    return success(transfer);
  } catch (err) {
    logger.error('Failed to record intercompany transfer', normalizeErrorArg(err));
    return failure({
      code: 'RECORD_TRANSFER_FAILED',
      message: err instanceof Error ? err.message : 'Failed to record intercompany transfer',
    });
  }
}

/**
 * Reconcile and approve an intercompany transfer
 */
export async function reconcileIntercompanyTransferAction(
  transferId: string,
  notes?: string
): Promise<Result<IntercompanyTransfer, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const transfer = await reconcileIntercompanyTransfer(dbRes.value, transferId, authRes.value.userId, notes);
    return success(transfer);
  } catch (err) {
    logger.error(`Failed to reconcile intercompany transfer ${transferId}`, normalizeErrorArg(err));
    return failure({
      code: 'RECONCILE_TRANSFER_FAILED',
      message: err instanceof Error ? err.message : 'Failed to reconcile intercompany transfer',
    });
  }
}

/**
 * Verify cryptographic hash-chain integrity of the IPO audit ledger
 */
export async function verifyAuditVaultIntegrityAction(
  periodKey?: string
): Promise<Result<LedgerIntegrityResult, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const result = await verifyAuditLedgerChain(dbRes.value, periodKey);
    return success(result);
  } catch (err) {
    logger.error('Failed to verify audit vault integrity', normalizeErrorArg(err));
    return failure({
      code: 'VERIFY_INTEGRITY_FAILED',
      message: err instanceof Error ? err.message : 'Audit vault integrity check failed',
    });
  }
}

/**
 * Export SEC Form S-1 and VAS TT200 audit disclosure pack
 */
export async function exportFormS1AuditReportAction(
  periodKey: string
): Promise<Result<FormS1AuditPack, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const pack = await generateFormS1AuditPack(dbRes.value, periodKey);
    return success(pack);
  } catch (err) {
    logger.error(`Failed to export Form S-1 audit pack for ${periodKey}`, normalizeErrorArg(err));
    return failure({
      code: 'AUDIT_PACK_EXPORT_FAILED',
      message: err instanceof Error ? err.message : 'Failed to generate Form S-1 audit pack',
    });
  }
}

/**
 * Query current close status and aggregates for a period
 */
export async function getFinancialPeriodStatusAction(
  periodKey: string
): Promise<Result<FinancialClosePeriod | null, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;

  try {
    const status = await getPeriodStatus(dbRes.value, periodKey);
    return success(status);
  } catch (err) {
    logger.error(`Failed to get status for ${periodKey}`, normalizeErrorArg(err));
    return failure({
      code: 'GET_PERIOD_STATUS_FAILED',
      message: err instanceof Error ? err.message : 'Failed to retrieve period status',
    });
  }
}
