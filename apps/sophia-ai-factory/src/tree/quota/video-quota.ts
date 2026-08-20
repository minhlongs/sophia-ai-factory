/**
 * Video Quota Enforcement — per-user, per-month counter.
 *
 * Uses a separate `video_usage_monthly` table (NOT the credit/nonce billing
 * system) to keep video rate-limiting decoupled from payment flows.
 *
 * Schema: (user_id TEXT, year_month TEXT "YYYY-MM", count INTEGER, updated_at TEXT)
 * PK: (user_id, year_month)
 *
 * Reservation is atomic: a single SQL UPSERT with `WHERE count < limit` predicate
 * eliminates the read-then-increment TOCTOU race that allowed concurrent bursts
 * to exceed tier quotas.
 */

import { createServerClient, getD1 } from '@/seed/db/client';

/** Monthly video quota by tier. BASIC gets 0 (blocked upstream by 402 gate). */
export const VIDEO_QUOTA_BY_TIER: Record<string, number> = {
  BASIC: 0,
  PREMIUM: 30,
  ENTERPRISE: 200,
  MASTER: 1000,
};

export interface VideoQuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  resetAt: string;
}

export interface VideoSlotReservation {
  reserved: boolean;
  used: number;
  limit: number;
  resetAt: string;
}

function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function nextMonthResetAt(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString();
}

async function readUsage(userId: string, yearMonth: string): Promise<number> {
  const db = createServerClient();
  const { data } = await db
    .from('video_usage_monthly')
    .select('count')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .maybeSingle();
  return (data as { count: number } | null)?.count ?? 0;
}

/**
 * Read current quota status without mutating anything.
 * Kept for callers that only need to display usage (e.g. dashboard quota bar).
 */
export async function checkVideoQuota(
  userId: string,
  tier: string,
): Promise<VideoQuotaStatus> {
  const limit = VIDEO_QUOTA_BY_TIER[tier] ?? 0;
  const yearMonth = currentYearMonth();
  const used = await readUsage(userId, yearMonth);
  return { allowed: used < limit, used, limit, resetAt: nextMonthResetAt() };
}

/**
 * Atomically reserve one video slot for `userId` at the given tier.
 *
 * SQL semantics: a single UPSERT with `WHERE count < limit` on the conflict
 * branch — the row is created (count=1) on first use, incremented on subsequent
 * use, and the WHERE predicate prevents any increment past `limit`. RETURNING
 * surfaces the new count if (and only if) a row was actually written.
 *
 * Returns `reserved=false` when the limit is reached or the tier has no quota
 * (limit=0). Caller should reject the request with HTTP 429.
 */
export async function reserveVideoSlot(
  userId: string,
  tier: string,
): Promise<VideoSlotReservation> {
  const limit = VIDEO_QUOTA_BY_TIER[tier] ?? 0;
  const yearMonth = currentYearMonth();
  const resetAt = nextMonthResetAt();

  if (limit === 0) {
    const used = await readUsage(userId, yearMonth);
    return { reserved: false, used, limit, resetAt };
  }

  const now = new Date().toISOString();
  const _d1 = await getD1();
  if (!_d1) throw new Error('D1 database binding not available');
  const d1 = _d1;
  const { results } = await d1
    .prepare(
      `INSERT INTO video_usage_monthly (user_id, year_month, count, updated_at)
       VALUES (?1, ?2, 1, ?3)
       ON CONFLICT(user_id, year_month) DO UPDATE SET
         count = video_usage_monthly.count + 1,
         updated_at = ?3
       WHERE video_usage_monthly.count < ?4
       RETURNING count`,
    )
    .bind(userId, yearMonth, now, limit)
    .all<{ count: number }>();

  // Invalidate edge cache so next quota check reads fresh D1 data
  const kv = globalThis.KV_KV as KVNamespace | undefined
  await kv?.delete(`quota:video:${userId}:${yearMonth}`).catch(() => { /* fail-open */ })

  if (results && results.length > 0) {
    return { reserved: true, used: results[0].count, limit, resetAt };
  }

  // Invalidate edge cache — D1 was mutated (increment path) or limit reached

  const used = await readUsage(userId, yearMonth);
  return { reserved: false, used, limit, resetAt };
}

/**
 * Best-effort decrement after a downstream failure (e.g. HeyGen rejected the
 * reservation). Floors at 0 so a missing row or already-zeroed counter is a
 * no-op. Failures are swallowed by the caller — losing one slot is preferable
 * to crashing the user request.
 */
export async function releaseVideoSlot(userId: string): Promise<void> {
  const yearMonth = currentYearMonth();
  const now = new Date().toISOString();
  const _d1 = await getD1();
  if (!_d1) throw new Error('D1 database binding not available');
  const d1 = _d1;
  await d1
    .prepare(
      `UPDATE video_usage_monthly
       SET count = count - 1, updated_at = ?3
       WHERE user_id = ?1 AND year_month = ?2 AND count > 0`,
    )
    .bind(userId, yearMonth, now)
    .run();

  // Invalidate edge cache after decrement
  const kv = globalThis.KV_KV as KVNamespace | undefined
  await kv?.delete(`quota:video:${userId}:${yearMonth}`).catch(() => { /* fail-open */ })
}

/**
 * @deprecated Use `reserveVideoSlot` for the create flow. Retained because
 * dashboards and tests may still want to bump usage outside the reservation
 * path. New callers should not introduce read-then-increment patterns.
 */
export async function incrementVideoUsage(userId: string): Promise<void> {
  const yearMonth = currentYearMonth();
  const now = new Date().toISOString();
  const _d1 = await getD1();
  if (!_d1) throw new Error('D1 database binding not available');
  const d1 = _d1;
  await d1
    .prepare(
      `INSERT INTO video_usage_monthly (user_id, year_month, count, updated_at)
       VALUES (?1, ?2, 1, ?3)
       ON CONFLICT(user_id, year_month) DO UPDATE SET
         count = video_usage_monthly.count + 1,
         updated_at = ?3`,
    )
    .bind(userId, yearMonth, now)
    .run();

  // Invalidate edge cache after increment
  const kv = globalThis.KV_KV as KVNamespace | undefined
  await kv?.delete(`quota:video:${userId}:${yearMonth}`).catch(() => { /* fail-open */ })
}
