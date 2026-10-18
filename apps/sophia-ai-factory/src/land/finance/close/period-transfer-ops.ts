/**
 * Intercompany transfer ledger operations for financial period closing
 * @module land/finance/close/period-transfer-ops
 */

import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  IntercompanyTransfer,
  RecordTransferInput,
} from '@/seed/types/financial-close';
import {
  recordIntercompanyTransfer,
  reconcileIntercompanyTransfer,
} from '@/tree/finance/financial-close-orchestrator';
import { type FinancialCloseActionError, normalizeErrorArg } from './types';

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
