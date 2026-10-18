/**
 * NOWPayments IPN One-Time Refund Audit & Tier Revert Helpers
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/ipn/ipn-refund-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import { recordAudit } from '@/seed/db/audit/audit-log';
import { revokeAccessByPurchaseId } from '@/seed/db/repositories/videos-repo';

export async function revokeRefundedPurchaseAccess(
  userId: string,
  purchaseId: string | null,
  paymentId: number | string,
): Promise<void> {
  if (!purchaseId) return;
  try {
    await revokeAccessByPurchaseId(purchaseId);
    logger.info('[IPN/OneTime] Video access revoked for refunded purchase', {
      userId,
      purchaseId,
      paymentId,
    });
  } catch (revokeErr) {
    logger.error(
      '[IPN/OneTime] Video access revocation failed',
      revokeErr instanceof Error ? revokeErr : undefined,
      { userId, purchaseId, paymentId },
    );
    throw revokeErr;
  }
}

export async function recordRefundAudit(
  userId: string,
  purchaseId: string | null,
  paymentId: string,
): Promise<void> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await recordAudit(db, {
      tableName: 'user_purchases',
      rowId: purchaseId ?? paymentId,
      action: 'update',
      actorId: userId,
      after: { status: 'refunded', credits_remaining: 0, paymentId, accessRevoked: true },
    });
  } catch (auditErr) {
    logger.error(
      '[IPN/OneTime] Refund audit failed (non-fatal)',
      auditErr instanceof Error ? auditErr : undefined,
      { userId, purchaseId, paymentId },
    );
  }
}
