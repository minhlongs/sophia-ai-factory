import { getD1 } from '@/seed/db/client';
import type {
  TierConversionRates,
  PromoCodeEffectiveness,
  CheckoutAbandonmentRate,
} from './types';
import {
  countTierTransition,
  queryTierTransitions,
  queryTierCancellations,
  queryPromoRedemptionStats,
} from './conversion-aggregator-helpers';

export {
  countTierTransition,
  queryTierTransitions,
  queryTierCancellations,
  queryPromoRedemptionStats,
} from './conversion-aggregator-helpers';

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

  const transitions = await queryTierTransitions(db, fromIso, toIso);
  const cancellations = await queryTierCancellations(db, fromIso, toIso);

  return {
    fromTs,
    toTs,
    transitions,
    freeToPaid:
      countTierTransition(transitions, null, 'BASIC') +
      countTierTransition(transitions, 'FREE', 'BASIC'),
    basicToPremium: countTierTransition(transitions, 'BASIC', 'PREMIUM'),
    premiumToEnterprise: countTierTransition(transitions, 'PREMIUM', 'ENTERPRISE'),
    enterpriseToMaster: countTierTransition(transitions, 'ENTERPRISE', 'MASTER'),
    cancellations,
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

  const { total, redeemed, reserved, reverted, topCodes } =
    await queryPromoRedemptionStats(db, fromTs, toTs, limit);

  return {
    fromTs,
    toTs,
    total,
    redeemed,
    reserved,
    reverted,
    successRate: total > 0 ? redeemed / total : 0,
    topCodes,
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
    abandonmentRate:
      checkoutStarted > 0
        ? (checkoutStarted - paymentSuccess) / checkoutStarted
        : 0,
  };
}
