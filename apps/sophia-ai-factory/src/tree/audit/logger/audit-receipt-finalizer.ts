/**
 * Audit Receipt Finalizer — shared helper for inserting an audit log
 * and storing its cryptographic compliance receipt signature.
 *
 * Layer: tree/audit/logger
 */

import { createServerClient } from '@/seed/db/client';
import { generateReceipt, type ComplianceReceipt } from '@/tree/audit/compliance-receipt';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  insertAuditLog,
  updateReceiptSignature,
} from '@/tree/audit/logger/audit-event-builder';

/**
 * Generate receipt and store signature back in DB.
 */
export async function finalizeReceipt(
  db: ReturnType<typeof createServerClient>,
  logId: string,
  log: Record<string, unknown>,
): Promise<ComplianceReceipt> {
  const receipt = generateReceipt(log);
  const updateError = await updateReceiptSignature(db, logId, receipt.signature);
  if (updateError) {
    logger.error('[Audit Logger] Failed to store receipt signature', toError(updateError));
  }
  return receipt;
}

/**
 * Insert an audit log row and finalize its compliance receipt.
 */
export async function insertAndFinalizeAuditLog(
  db: ReturnType<typeof createServerClient>,
  logData: Record<string, unknown>,
  failureMessage: string,
): Promise<{ logId: string; receipt: ComplianceReceipt } | null> {
  const { data: insertedLog, error } = await insertAuditLog(db, logData);
  if (error || !insertedLog) {
    logger.error(failureMessage, toError(error));
    return null;
  }
  const logId = (insertedLog as Record<string, unknown>).id as string;
  const receipt = await finalizeReceipt(
    db,
    logId,
    insertedLog as Record<string, unknown>,
  );
  return { logId, receipt };
}

/** Shared safe wrapper for core audit writers that also logs caller context. */
export async function writeAuditWithReceipt(
  logData: Record<string, unknown>,
  insertFailureMessage: string,
  failureMessage: string,
  onFinalized: (logId: string, receipt: ComplianceReceipt) => void,
): Promise<ComplianceReceipt | null> {
  try {
    const finalized = await insertAndFinalizeAuditLog(
      createServerClient(),
      logData,
      insertFailureMessage,
    );
    if (!finalized) return null;
    onFinalized(finalized.logId, finalized.receipt);
    return finalized.receipt;
  } catch (error) {
    logger.error(failureMessage, toError(error));
    return null;
  }
}
