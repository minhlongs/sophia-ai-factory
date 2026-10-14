/**
 * Video Quota Helpers — Date windowing, D1 usage query, and KV invalidation.
 * @module tree/quota/video-quota-helpers
 */

import { createServerClient } from '@/seed/db/client';

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

export function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function nextMonthResetAt(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString();
}

export async function readVideoUsage(userId: string, yearMonth: string): Promise<number> {
  const db = createServerClient();
  const { data } = await db
    .from('video_usage_monthly')
    .select('count')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .maybeSingle();
  return (data as { count: number } | null)?.count ?? 0;
}

export async function invalidateVideoQuotaEdgeCache(
  userId: string,
  yearMonth: string,
): Promise<void> {
  const kv = globalThis.KV_KV as KVNamespace | undefined;
  await kv?.delete(`quota:video:${userId}:${yearMonth}`).catch(() => {
    /* fail-open */
  });
}
