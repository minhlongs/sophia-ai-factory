import { getD1 } from '@/seed/db/client';
import type {
  TierConversionRates,
  TierTransition,
  PromoCodeEffectiveness,
  CheckoutAbandonmentRate,
} from './types';

/**
 * Compute tier upgrade/downgrade rates within a time window.
 * Sources: tier_change_events table (written by NOWPayments IPN handler).
 *
 * Rates are based on event counts, not unique users.
 */
export async function getTierConversionRates(
  fromTs: number,
  toTs: number,
): Promise<TierConversionRates> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const fromIso = new Date(fromTs * 1000).toISOString();
  const toIso = new Date(toTs * 1000).toISOString();

  // Aggregate all transitions in window
  const rows = await db
    .prepare(
      `SELECT from_tier, to_tier, COUNT(*) AS cnt
       FROM tier_change_events
       WHERE datetime(created_at) >= datetime(?1)
         AND datetime(created_at) <= datetime(?2)
       GROUP BY from_tier, to_tier`,
    )
    .bind(fromIso, toIso)
    .all<{ from_tier: string | null; to_tier: string | null; cnt: number }>();

  const transitions: TierTransition[] = (rows.results ?? []).map((r) => ({
    fromTier: r.from_tier ?? 'FREE',
    toTier: r.to_tier ?? 'FREE',
    count: Number(r.cnt),
  }));

  // Summaries for common upgrade paths
  function countTransition(from: string | null, to: string): number {
    return transitions
      .filter((t) => (from === null || t.fromTier === from) && t.toTier === to)
      .reduce((sum, t) => sum + t.count, 0);
  }

  const cancellationRows = await db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM tier_change_events
       WHERE event_type IN ('cancel', 'downgrade')
         AND datetime(created_at) >= datetime(?1)
         AND datetime(created_at) <= datetime(?2)`,
    )
    .bind(fromIso, toIso)
    .first<{ n: number }>();

  return {
    fromTs,
    toTs,
    transitions,
    freeToPaid: countTransition(null, 'BASIC') + countTransition('FREE', 'BASIC'),
    basicToPremium: countTransition('BASIC', 'PREMIUM'),
    premiumToEnterprise: countTransition('PREMIUM', 'ENTERPRISE'),
    enterpriseToMaster: countTransition('ENTERPRISE', 'MASTER'),
    cancellations: Number(cancellationRows?.n ?? 0),
  };
}

/**
 * Measure promo code effectiveness: reserved vs redeemed success rates.
 * Sources: promo_code_redemptions table.
 */
export async function getPromoCodeEffectiveness(
  fromTs: number,
  toTs: number,
  limit = 10,
): Promise<PromoCodeEffectiveness> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const fromEpoch = fromTs;
  const toEpoch = toTs;

  const statusRow = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) AS redeemed,
         SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) AS reserved,
         SUM(CASE WHEN status = 'reverted' THEN 1 ELSE 0 END) AS reverted
       FROM promo_code_redemptions
       WHERE redeemed_at >= ?1 AND redeemed_at <= ?2`,
    )
    .bind(fromEpoch, toEpoch)
    .first<{ total: number; redeemed: number; reserved: number; reverted: number }>();

  const topCodesRows = await db
    .prepare(
      `SELECT promo_code AS code, COUNT(*) AS cnt
       FROM promo_code_redemptions
       WHERE redeemed_at >= ?1 AND redeemed_at <= ?2
         AND status = 'redeemed'
       GROUP BY promo_code
       ORDER BY cnt DESC
       LIMIT ?3`,
    )
    .bind(fromEpoch, toEpoch, limit)
    .all<{ code: string; cnt: number }>();

  const total = Number(statusRow?.total ?? 0);
  const redeemed = Number(statusRow?.redeemed ?? 0);
  const reserved = Number(statusRow?.reserved ?? 0);
  const reverted = Number(statusRow?.reverted ?? 0);

  return {
    fromTs,
    toTs,
    total,
    redeemed,
    reserved,
    reverted,
    successRate: total > 0 ? redeemed / total : 0,
    topCodes: (topCodesRows.results ?? []).map((r) => ({
      code: r.code,
      count: Number(r.cnt),
    })),
  };
}

/**
 * Measure checkout abandonment rate within a window.
 */
export async function getCheckoutAbandonmentRate(
  fromTs: number,
  toTs: number,
): Promise<CheckoutAbandonmentRate> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const fromMs = fromTs * 1000;
  const toMs = toTs * 1000;

  const startedRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM signals_events
       WHERE event_type = 'checkout_started'
         AND ts >= ?1 AND ts <= ?2`,
    )
    .bind(fromMs, toMs)
    .first<{ n: number }>();

  const successRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM signals_events
       WHERE event_type = 'payment_success'
         AND ts >= ?1 AND ts <= ?2`,
    )
    .bind(fromMs, toMs)
    .first<{ n: number }>();

  const checkoutStarted = Number(startedRow?.n ?? 0);
  const paymentSuccess = Number(successRow?.n ?? 0);

  return {
    fromTs,
    toTs,
    checkoutStarted,
    paymentSuccess,
    abandonmentRate: checkoutStarted > 0
      ? (checkoutStarted - paymentSuccess) / checkoutStarted
      : 0,
  };
}
