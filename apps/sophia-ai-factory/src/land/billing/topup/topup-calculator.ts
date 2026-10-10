/**
 * Top-Up Calculation and Reconciliation Helpers
 *
 * Layer: land (Business domain workflows)
 * @module land/billing/topup/topup-calculator
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  TOPUP_PRICE_PER_MCU,
  TOPUP_CREDIT_EXPIRY_DAYS,
  type TopupPriceCalculation,
} from './types';

/**
 * Calculates topup pricing, generated order ID, and expiry timestamp.
 */
export function calculateTopupPrice(userId: string, mcuAmount: number): TopupPriceCalculation {
  const priceCents = Math.round(mcuAmount * TOPUP_PRICE_PER_MCU * 100);
  const priceUsd = priceCents / 100;
  const orderId = `topup_${userId}_${Date.now()}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  return { priceCents, priceUsd, orderId, expiresAt };
}

/**
 * Extracts userId from topup orderId format (`topup_${userId}_${timestamp}`).
 */
export function parseUserIdFromOrderId(orderId: string): string | null {
  if (!orderId.startsWith('topup_')) return null;
  const sliced = orderId.slice('topup_'.length);
  return sliced.split('_').slice(0, -1).join('_') || sliced;
}

/**
 * Grants user credits atomically with 30-day expiration.
 */
export async function grantUserCredits(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  mcuAmount: number,
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOPUP_CREDIT_EXPIRY_DAYS);

  await db
    .prepare(
      `INSERT INTO user_credits (user_id, credits_remaining, credits_total_purchased, expires_at)
       VALUES (?1, ?2, ?2, ?3)
       ON CONFLICT(user_id) DO UPDATE SET
         credits_remaining = credits_remaining + ?2,
         credits_total_purchased = credits_total_purchased + ?2,
         expires_at = ?3`,
    )
    .bind(userId, mcuAmount, Math.floor(expiresAt.getTime() / 1000))
    .run();
}

/**
 * Get IDs of unbilled overage events for a user.
 */
export async function getUnbilledOverageEventIds(userId: string): Promise<string[]> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('overage_events')
      .select('id')
      .eq('user_id', userId)
      .eq('billable', false)
      .limit(100);

    if (!data || !Array.isArray(data)) return [];
    return (data as Array<{ id: string }>).map((row) => row.id);
  } catch {
    return [];
  }
}

/**
 * Handles stale locks (>5 minutes) best-effort recovery.
 */
export async function resolveStaleLock(
  db: ReturnType<typeof createServerClient>,
  eventId: string,
  createdAt: string,
  paymentId: string,
  now: string,
): Promise<{ isStale: boolean }> {
  const lockAgeMs = Date.now() - new Date(createdAt ?? now).getTime();
  if (lockAgeMs > 5 * 60 * 1000) {
    logger.error('[OverageTopup] Stale lock cleared', { eventId, payment_id: paymentId });
    try {
      await db
        .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
        .bind(eventId)
        .run();
    } catch {
      // Non-fatal — stale lock cleared best-effort
    }
    return { isStale: true };
  }
  return { isStale: false };
}
