/**
 * Activation funnel analytics.
 *
 * Single primitive that counts users at each step of the activation funnel
 * within a signup date window:
 *   1. Signup (user.createdAt within window)
 *   2. First login (≥1 session row)
 *   3. First video (≥1 video_jobs row)
 *   4. First conversion (≥1 conversion_events.status IN ('approved','paid'))
 *
 * Also exposes:
 *   - getTierConversionRates: measures free→BASIC, BASIC→PREMIUM upgrade rates
 *     using tier_change_events table.
 *   - getPromoCodeEffectiveness: measures reserved vs redeemed success rate
 *     using promo_code_redemptions table.
 *   - getCheckoutAbandonmentRate: compares checkout_started D1 signals vs
 *     confirmed payment_success signals in the same window.
 *
 * Used by /dashboard/admin/funnel + /api/admin/funnel. All queries are
 * tenant-agnostic (admin scope) and use indexed columns where possible.
 *
 * @module land/analytics/funnel-stats
 */

import { getD1Raw } from '@/seed/db/client';

export interface ActivationFunnel {
  /** Unix seconds, inclusive. */
  fromTs: number;
  /** Unix seconds, inclusive. */
  toTs: number;
  signups: number;
  firstLogin: number;
  firstVideo: number;
  firstConversion: number;
  conversions: {
    signupToLogin: number;
    loginToVideo: number;
    videoToConversion: number;
  };
}

/** Tier-to-tier upgrade/downgrade counts within a time window. */
export interface TierTransition {
  fromTier: string;
  toTier: string;
  count: number;
}

export interface TierConversionRates {
  fromTs: number;
  toTs: number;
  /** All tier transitions in the window (upgrade + activate + downgrade). */
  transitions: TierTransition[];
  /** Free → any paid tier activations. */
  freeToPaid: number;
  /** BASIC → PREMIUM upgrades. */
  basicToPremium: number;
  /** PREMIUM → ENTERPRISE upgrades. */
  premiumToEnterprise: number;
  /** ENTERPRISE → MASTER upgrades. */
  enterpriseToMaster: number;
  /** Any cancellations (downgrade or cancel). */
  cancellations: number;
}

export interface PromoCodeEffectiveness {
  fromTs: number;
  toTs: number;
  /** Total promo redemptions in window (all statuses). */
  total: number;
  /** Successfully redeemed (status = 'redeemed'). */
  redeemed: number;
  /** Reserved but not yet confirmed (status = 'reserved'). */
  reserved: number;
  /** Reverted / cancelled redemptions. */
  reverted: number;
  /** Redemption success rate: redeemed / (redeemed + reserved + reverted). */
  successRate: number;
  /** Top promo codes by redemption count. */
  topCodes: Array<{ code: string; count: number }>;
}

export interface CheckoutAbandonmentRate {
  fromTs: number;
  toTs: number;
  /** checkout_started signals fired (pending_orders written). */
  checkoutStarted: number;
  /** payment_success signals fired (IPN confirmed). */
  paymentSuccess: number;
  /** Abandonment rate: (started - success) / started. */
  abandonmentRate: number;
}

/**
 * Compute activation funnel counts for users who signed up within the window.
 * Subsequent step counts are restricted to that signup cohort — i.e.
 * `firstLogin` only counts users in the cohort who later logged in (timing of
 * the login itself can fall outside the window).
 */
export async function getActivationFunnel(
  fromTs: number,
  toTs: number,
): Promise<ActivationFunnel> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const db = await getD1Raw();

  const fromIso = new Date(fromTs * 1000).toISOString();
  const toIso = new Date(toTs * 1000).toISOString();

  const cohortClause = `datetime(u.createdAt) >= datetime(?1)
                        AND datetime(u.createdAt) <= datetime(?2)`;

  const signupRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM "user" u WHERE ${cohortClause}`)
    .bind(fromIso, toIso)
    .first<{ n: number }>();

  const loginRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM "user" u
       WHERE ${cohortClause}
         AND EXISTS (SELECT 1 FROM "session" s WHERE s.userId = u.id)`,
    )
    .bind(fromIso, toIso)
    .first<{ n: number }>();

  const videoRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM "user" u
       WHERE ${cohortClause}
         AND EXISTS (SELECT 1 FROM videos v WHERE v.user_id = u.id)`,
    )
    .bind(fromIso, toIso)
    .first<{ n: number }>();

  const conversionRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM "user" u
       WHERE ${cohortClause}
         AND EXISTS (
           SELECT 1
           FROM conversion_events cv
           JOIN affiliate_links al ON al.id = cv.link_id
           WHERE al.user_id = u.id
             AND cv.status IN ('approved','paid')
         )`,
    )
    .bind(fromIso, toIso)
    .first<{ n: number }>();

  const signups = Number(signupRow?.n ?? 0);
  const firstLogin = Number(loginRow?.n ?? 0);
  const firstVideo = Number(videoRow?.n ?? 0);
  const firstConversion = Number(conversionRow?.n ?? 0);

  return {
    fromTs,
    toTs,
    signups,
    firstLogin,
    firstVideo,
    firstConversion,
    conversions: {
      signupToLogin: signups > 0 ? firstLogin / signups : 0,
      loginToVideo: firstLogin > 0 ? firstVideo / firstLogin : 0,
      videoToConversion: firstVideo > 0 ? firstConversion / firstVideo : 0,
    },
  };
}

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
  const db = await getD1Raw();

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
 *
 * @param fromTs  Window start (Unix seconds)
 * @param toTs    Window end (Unix seconds)
 * @param limit   Max top-codes to return (default 10)
 */
export async function getPromoCodeEffectiveness(
  fromTs: number,
  toTs: number,
  limit = 10,
): Promise<PromoCodeEffectiveness> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const db = await getD1Raw();

  // promo_code_redemptions.redeemed_at is Unix epoch INTEGER
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
 *
 * Uses signals_events D1 table:
 * - 'checkout_started' event count = intent
 * - 'payment_success' event count = confirmed
 * Abandonment = (started - success) / started
 *
 * Note: Both counts are per-event (not deduplicated per user), so the
 * rate reflects event volume, not unique abandonment.
 */
export async function getCheckoutAbandonmentRate(
  fromTs: number,
  toTs: number,
): Promise<CheckoutAbandonmentRate> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const db = await getD1Raw();

  // signals_events.ts is Unix milliseconds
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
