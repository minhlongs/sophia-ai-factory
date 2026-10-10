/**
 * Promo code queries & status validators
 * @module land/promo/repo/coupon-validator
 */

import { getD1 } from '@/seed/db/client';
import type { PromoCodeRow, RedemptionRow } from './types';

export async function getCodeByCode(code: string): Promise<PromoCodeRow | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const row = await db
    .prepare(`SELECT * FROM promo_codes WHERE code = ?1 LIMIT 1`)
    .bind(code.toUpperCase())
    .first<PromoCodeRow>();
  return row ?? null;
}

export async function getRedemptionCount(codeId: string, userId: string): Promise<number> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const row = await db
    .prepare(
      `SELECT COUNT(*) as cnt FROM promo_code_redemptions
       WHERE promo_code_id = ?1 AND user_id = ?2 AND status != 'reverted'`,
    )
    .bind(codeId, userId)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export async function findReservedRedemption(
  userId: string,
  promoCode: string,
): Promise<RedemptionRow | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const row = await db
    .prepare(
      `SELECT * FROM promo_code_redemptions
       WHERE user_id = ?1 AND promo_code = ?2 AND status = 'reserved'
       ORDER BY redeemed_at DESC LIMIT 1`,
    )
    .bind(userId, promoCode.toUpperCase())
    .first<RedemptionRow>();
  return row ?? null;
}
