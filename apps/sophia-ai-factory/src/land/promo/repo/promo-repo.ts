/**
 * Promo code administrative operations & trial management
 * @module land/promo/repo/promo-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  PromoCodeRow,
  RedemptionRow,
  CreatePromoInput,
  ListAdminFilters,
} from './types';

function genId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export async function listAdminCodes(filters: ListAdminFilters = {}): Promise<PromoCodeRow[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const parts: string[] = ['SELECT * FROM promo_codes WHERE 1=1'];
  const bindings: (string | number)[] = [];
  let idx = 1;

  if (filters.status) {
    parts.push(`AND status = ?${idx++}`);
    bindings.push(filters.status);
  }
  if (filters.discountType) {
    parts.push(`AND discount_type = ?${idx++}`);
    bindings.push(filters.discountType);
  }
  if (filters.appliesToTier) {
    parts.push(`AND (applies_to_tier = ?${idx++} OR applies_to_tier IS NULL)`);
    bindings.push(filters.appliesToTier);
  }

  parts.push(`ORDER BY created_at DESC`);
  parts.push(`LIMIT ?${idx++} OFFSET ?${idx++}`);
  bindings.push(filters.limit ?? 50);
  bindings.push(filters.offset ?? 0);

  const stmt = db.prepare(parts.join(' ')).bind(...bindings);
  const { results } = await stmt.all<PromoCodeRow>();
  return results ?? [];
}

export async function createCode(
  input: CreatePromoInput,
  adminId: string,
): Promise<PromoCodeRow> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const id = genId();
  const nowSec = Math.floor(Date.now() / 1000);
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

  await db
    .prepare(
      `INSERT INTO promo_codes
       (id, code, description, discount_type, discount_value, applies_to_tier, applies_to_sku,
        max_uses, max_uses_per_user, valid_from, valid_until, status, created_by_admin_id, created_at, metadata)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'active',?12,?13,?14)`,
    )
    .bind(
      id,
      input.code.toUpperCase(),
      input.description ?? null,
      input.discountType,
      input.discountValue,
      input.appliesToTier ?? null,
      input.appliesToSku ?? null,
      input.maxUses ?? null,
      input.maxUsesPerUser ?? 1,
      nowSec,
      input.validUntil ?? null,
      adminId,
      nowSec,
      metadata,
    )
    .run();

  return {
    id,
    code: input.code.toUpperCase(),
    description: input.description ?? null,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    applies_to_tier: input.appliesToTier ?? null,
    applies_to_sku: input.appliesToSku ?? null,
    max_uses: input.maxUses ?? null,
    used_count: 0,
    max_uses_per_user: input.maxUsesPerUser ?? 1,
    valid_from: nowSec,
    valid_until: input.validUntil ?? null,
    status: 'active',
    created_by_admin_id: adminId,
    created_at: nowSec,
    metadata,
  };
}

export async function updateCodeStatus(
  codeId: string,
  status: 'active' | 'disabled' | 'expired',
): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  await db
    .prepare(`UPDATE promo_codes SET status = ?1 WHERE id = ?2`)
    .bind(status, codeId)
    .run();
}

export async function listRedemptionsByCode(
  codeId: string,
  limit = 50,
  offset = 0,
): Promise<RedemptionRow[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const { results } = await db
    .prepare(
      `SELECT * FROM promo_code_redemptions
       WHERE promo_code_id = ?1
       ORDER BY redeemed_at DESC
       LIMIT ?2 OFFSET ?3`,
    )
    .bind(codeId, limit, offset)
    .all<RedemptionRow>();
  return results ?? [];
}

export async function setUserTrialExpiry(
  userId: string,
  trialEndsAt: number,
): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const nowSec = Math.floor(Date.now() / 1000);
  try {
    await db
      .prepare(
        `UPDATE subscriptions SET trial_ends_at = ?1, updated_at = ?2 WHERE user_id = ?3`,
      )
      .bind(trialEndsAt, nowSec, userId)
      .run();
  } catch (err) {
    logger.warn('[PromoRepo] setUserTrialExpiry failed', { userId, error: err instanceof Error ? err.message : String(err) });
  }
}

export async function getExpiredTrialUsers(nowSec: number): Promise<{ user_id: string; email: string | null }[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const { results } = await db
    .prepare(
      `SELECT s.user_id, u.email
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.trial_ends_at IS NOT NULL
         AND s.trial_ends_at <= ?1
         AND s.status = 'active'
       LIMIT 100`,
    )
    .bind(nowSec)
    .all<{ user_id: string; email: string | null }>();
  return results ?? [];
}
