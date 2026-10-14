/**
 * Idempotency and side-effect helpers for /api/admin/refunds/[id]/mark-refunded.
 * @module app/api/admin/refunds/[id]/mark-refunded/mark-refunded-helpers
 */

import { z } from 'zod';
import { revokeAccessByPurchaseId } from '@/seed/db/repositories/videos-repo';
import { writeAuditLog } from '@/tree/admin/audit-log';
import { sendRefundCompletedEmail } from '@/land/billing/email/send-refund-emails';
import { getD1 } from '@/seed/db/client';
import { getErrorMessage } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';

export const bodySchema = z.object({
  tx_hash: z.string().min(1).max(200),
  notes: z.string().max(500).optional(),
});

export interface CachedResult {
  id: string;
  status: string;
  tx_hash: string;
}

/** Return cached result if key exists and not expired, else null. */
export async function checkIdempotency(
  key: string,
  refundId: string,
): Promise<CachedResult | null> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    const row = await db
      .prepare(
        `SELECT refund_id, status FROM idempotency_keys
         WHERE key = ?1 AND refund_id = ?2 AND expires_at > unixepoch()`,
      )
      .bind(key, refundId)
      .first<{ refund_id: string; status: string }>();
    if (!row) return null;
    return { id: row.refund_id, status: row.status, tx_hash: '' };
  } catch {
    return null;
  }
}

/** Persist idempotency key (24h TTL). */
export async function storeIdempotency(
  key: string,
  refundId: string,
  body: CachedResult,
): Promise<void> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `INSERT OR REPLACE INTO idempotency_keys (key, refund_id, status, expires_at)
         VALUES (?1, ?2, ?3, unixepoch() + 86400)`,
      )
      .bind(key, refundId, body.status)
      .run();
  } catch (err) {
    logger.warn('[AdminRefunds] Idempotency store failed', { key, err: getErrorMessage(err) });
  }
}

export async function runPostRefundSideEffects(params: {
  id: string;
  actorUserId: string;
  targetUserId: string;
  purchaseId: string;
  txHash: string;
  tierBefore: string;
  tierAfter: string;
  mcuClawedBack: number;
}): Promise<void> {
  const { id, actorUserId, targetUserId, purchaseId, txHash, tierBefore, tierAfter, mcuClawedBack } = params;
  await revokeAccessByPurchaseId(purchaseId);

  await writeAuditLog({
    actorUserId,
    actionType: 'refund_marked_refunded',
    targetUserId,
    payload: { refundId: id, purchaseId, txHash, tierBefore, tierAfter, mcuClawedBack },
  });

  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const userRow = await db.prepare('SELECT email FROM user WHERE id = ?1').bind(targetUserId).first<{ email: string }>();
  if (userRow) {
    sendRefundCompletedEmail({
      userEmail: userRow.email,
      purchaseId,
      txHash,
    }).catch(() => null);
  }
}
