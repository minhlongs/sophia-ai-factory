/**
 * Video Quota Enforcement — per-user, per-month counter.
 *
 * Uses a separate `video_usage_monthly` table (NOT the credit/nonce billing
 * system) to keep video rate-limiting decoupled from payment flows.
 *
 * Schema: (user_id TEXT, year_month TEXT "YYYY-MM", count INTEGER, updated_at TEXT)
 * PK: (user_id, year_month)
 */

import { createServerClient, getD1Raw } from '@/lib/db/client';

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
  resetAt: string; // ISO — first day of next month UTC
}

/** Returns YYYY-MM for the current UTC month. */
function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Returns ISO date string for the first day of next month (quota reset point). */
function nextMonthResetAt(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString();
}

/**
 * Check whether `userId` is within their monthly video quota for `tier`.
 * Reads `video_usage_monthly`. Returns quota status including current usage.
 */
export async function checkVideoQuota(
  userId: string,
  tier: string,
): Promise<VideoQuotaStatus> {
  const limit = VIDEO_QUOTA_BY_TIER[tier] ?? 0;
  const yearMonth = currentYearMonth();
  const resetAt = nextMonthResetAt();

  const db = createServerClient();
  const { data } = await db
    .from('video_usage_monthly')
    .select('count')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  const used = (data as { count: number } | null)?.count ?? 0;

  return { allowed: used < limit, used, limit, resetAt };
}

/**
 * Increment the monthly video counter for `userId`.
 * Uses INSERT … ON CONFLICT DO UPDATE (upsert) so it is always safe to call.
 * Call ONLY after a successful HeyGen video creation to avoid penalising failures.
 */
export async function incrementVideoUsage(userId: string): Promise<void> {
  const yearMonth = currentYearMonth();
  const now = new Date().toISOString();

  // Use the raw D1 binding to execute the upsert directly —
  // the query-chain builder does not expose ON CONFLICT syntax.
  const d1 = await getD1Raw();
  await d1
    .prepare(
      `INSERT INTO video_usage_monthly (user_id, year_month, count, updated_at)
       VALUES (?1, ?2, 1, ?3)
       ON CONFLICT(user_id, year_month) DO UPDATE SET
         count = count + 1,
         updated_at = ?3`,
    )
    .bind(userId, yearMonth, now)
    .run();
}
