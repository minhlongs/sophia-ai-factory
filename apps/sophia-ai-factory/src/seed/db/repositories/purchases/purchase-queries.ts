/**
 * User Purchases Lookups and Queries
 * Layer: SEED (Foundational Primitives)
 */

import { createServerClient } from '@/seed/db/client';
import type { UserPurchase } from '@/seed/types';

/** Fetch a purchase row by NOWPayments payment_id. */
export async function getByPaymentId(paymentId: string): Promise<UserPurchase | null> {
  const db = createServerClient();
  const { data } = await db
    .from('user_purchases')
    .select('*')
    .eq('payment_id', paymentId)
    .single();
  return (data as UserPurchase | null) ?? null;
}

/** Fetch all purchases for a user (ordered latest first). */
export async function listByUser(userId: string): Promise<UserPurchase[]> {
  const db = createServerClient();
  const { data } = await db
    .from('user_purchases')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as UserPurchase[] | null) ?? [];
}

/** Fetch remaining credits for a user's active one-time purchases. */
export async function getUserCredits(
  userId: string,
): Promise<{ creditsRemaining: number; expiresAt: number | null }> {
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  const { data } = await db
    .from('user_purchases')
    .select('credits_remaining, expires_at')
    .eq('user_id', userId)
    .eq('kind', 'one_time')
    .eq('status', 'paid')
    .gte('expires_at', now);

  const rows = (data as Array<{ credits_remaining: number; expires_at: number | null }> | null) ?? [];
  const total = rows.reduce((sum, r) => sum + (r.credits_remaining ?? 0), 0);
  const nearestExpiry = rows.reduce<number | null>((min, r) => {
    if (!r.expires_at) return min;
    if (min === null || r.expires_at < min) return r.expires_at;
    return min;
  }, null);

  return { creditsRemaining: total, expiresAt: nearestExpiry };
}
