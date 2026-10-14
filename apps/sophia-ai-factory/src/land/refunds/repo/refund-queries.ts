import { getD1 } from '@/seed/db/client';
import type { RefundRequest } from './types';

export async function listPendingRefunds(): Promise<RefundRequest[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const result = await db
    .prepare('SELECT * FROM refund_requests ORDER BY created_at DESC LIMIT 200')
    .all<RefundRequest>();
  return result.results ?? [];
}

export async function getRefundById(id: string): Promise<RefundRequest | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare('SELECT * FROM refund_requests WHERE id = ?1')
    .bind(id)
    .first<RefundRequest>();
  return row ?? null;
}

export async function getRefundByPurchaseAndUser(
  purchaseId: string,
  userId: string,
): Promise<RefundRequest | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare('SELECT * FROM refund_requests WHERE purchase_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(purchaseId, userId)
    .first<RefundRequest>();
  return row ?? null;
}
