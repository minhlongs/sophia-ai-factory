/**
 * Period closing state machine & transfer ledger operations
 * @module land/finance/close/period-closer
 */

import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  FinancialClosePeriod,
  IntercompanyTransfer,
  PeriodType,
  RecordTransferInput,
  FinalizePeriodResult,
} from '@/seed/types/financial-close';
import {
  initiatePeriodClose,
  finalizePeriodClose,
  lockPeriod,
  reopenPeriod,
  getPeriodStatus,
  recordIntercompanyTransfer,
  reconcileIntercompanyTransfer,
} from '@/tree/finance/financial-close-orchestrator';
import { type FinancialCloseActionError, normalizeErrorArg } from './types';

export async function executeInitiatePeriodClose(
  db: D1Database,
  periodKey: string,
  periodType: PeriodType,
  userId: string,
  startDateStr?: string,
  endDateStr?: string,
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  try {
    const period = await initiatePeriodClose(
      db,
      periodKey,
      periodType,
      userId,
      null,
      startDateStr,
      endDateStr,
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

export async function executeFinalizePeriodClose(
  db: D1Database,
  periodKey: string,
  userId: string,
): Promise<Result<FinalizePeriodResult, FinancialCloseActionError>> {
  try {
    const result = await finalizePeriodClose(db, periodKey, userId);
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

export async function executeLockPeriod(
  db: D1Database,
  periodKey: string,
  lockReason: string,
  userId: string,
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  try {
    const locked = await lockPeriod(db, periodKey, lockReason, userId);
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

export async function executeReopenPeriod(
  db: D1Database,
  periodKey: string,
  reason: string,
  userId: string,
): Promise<Result<FinancialClosePeriod, FinancialCloseActionError>> {
  try {
    const reopened = await reopenPeriod(db, periodKey, reason, userId);
    return success(reopened);
  } catch (err) {
    logger.error(`Failed to reopen period ${periodKey}`, normalizeErrorArg(err));
    return failure({
      code: 'REOPEN_PERIOD_FAILED',
      message: err instanceof Error ? err.message : 'Failed to reopen financial period',
    });
  }
}

export async function executeRecordTransfer(
  db: D1Database,
  input: RecordTransferInput,
  userId: string,
): Promise<Result<IntercompanyTransfer, FinancialCloseActionError>> {
  try {
    const transfer = await recordIntercompanyTransfer(db, input, userId);
    return success(transfer);
  } catch (err) {
    logger.error('Failed to record intercompany transfer', normalizeErrorArg(err));
    return failure({
      code: 'RECORD_TRANSFER_FAILED',
      message: err instanceof Error ? err.message : 'Failed to record intercompany transfer',
    });
  }
}

export async function executeReconcileTransfer(
  db: D1Database,
  transferId: string,
  userId: string,
  notes?: string,
): Promise<Result<IntercompanyTransfer, FinancialCloseActionError>> {
  try {
    const transfer = await reconcileIntercompanyTransfer(db, transferId, userId, notes);
    return success(transfer);
  } catch (err) {
    logger.error(`Failed to reconcile intercompany transfer ${transferId}`, normalizeErrorArg(err));
    return failure({
      code: 'RECONCILE_TRANSFER_FAILED',
      message: err instanceof Error ? err.message : 'Failed to reconcile intercompany transfer',
    });
  }
}

export async function executeGetPeriodStatus(
  db: D1Database,
  periodKey: string,
): Promise<Result<FinancialClosePeriod | null, FinancialCloseActionError>> {
  try {
    const status = await getPeriodStatus(db, periodKey);
    return success(status);
  } catch (err) {
    logger.error(`Failed to get status for ${periodKey}`, normalizeErrorArg(err));
    return failure({
      code: 'GET_PERIOD_STATUS_FAILED',
      message: err instanceof Error ? err.message : 'Failed to retrieve period status',
    });
  }
}
