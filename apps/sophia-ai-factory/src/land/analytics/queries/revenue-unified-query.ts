/**
 * Unified Revenue Query — D1 SQL aggregations by vertical x date.
 *
 * Verticals: saas | crypto | product
 *   saas    — raas_licenses + payment_events (subscription revenue)
 *   product — affiliate conversion_events for product networks
 *             (amazon, tiktok-shop, clickbank, accesstrade, awin)
 *   crypto  — affiliate conversion_events for crypto networks
 *             (binance, coinbase, bybit, etc. — slug prefix 'crypto-*')
 *
 * Network → vertical mapping is resolved server-side via SQL CASE expression
 * to avoid loading all affiliate_offers into memory.
 *
 * @module lib/analytics/queries/revenue-unified-query
 */

import { getD1 } from '@/seed/db/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RevenueVertical = 'saas' | 'crypto' | 'product';

export interface DailyVerticalRevenue {
  date: string; // YYYY-MM-DD
  saas: number;
  crypto: number;
  product: number;
  total: number;
}

export interface UnifiedRevenueSummary {
  totalThisMonth: number;
  byVertical: Record<RevenueVertical, number>;
  dailySeries: DailyVerticalRevenue[];
  periodDays: 7 | 30 | 90;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Network slugs that map to crypto vertical */
const CRYPTO_SLUGS = ['binance', 'coinbase', 'bybit', 'kucoin', 'okx', 'gate', 'bitget'];

/** Build SQL CASE expression: slug → vertical */
function verticalCaseExpr(): string {
  const cryptoList = CRYPTO_SLUGS.map(s => `'${s}'`).join(',');
  return `CASE
    WHEN an.slug IN (${cryptoList}) THEN 'crypto'
    ELSE 'product'
  END`;
}

interface ConversionAggRow {
  day: string;
  vertical: string;
  revenue: number;
}

// ── Saas daily series from payment_events ─────────────────────────────────────

async function fetchSaasDailySeries(
  db: D1Database,
  fromTs: string,
  toTs: string,
): Promise<Map<string, number>> {
  const dayMap = new Map<string, number>();

  // payment_events store raw NOWPayments payload; extract pay_amount per day
  const result = await db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS day,
              payload
       FROM payment_events
       WHERE created_at >= ? AND created_at <= ?`,
    )
    .bind(fromTs, toTs)
    .all<{ day: string; payload: string }>();

  for (const row of result.results ?? []) {
    try {
      const parsed = JSON.parse(row.payload) as Record<string, unknown>;
      const raw = parsed['pay_amount'];
      const amount = typeof raw === 'number' ? raw : parseFloat(raw as string) || 0;
      dayMap.set(row.day, (dayMap.get(row.day) ?? 0) + amount);
    } catch { /* skip malformed payload */ }
  }

  return dayMap;
}

// ── Affiliate daily series by vertical ────────────────────────────────────────

async function fetchAffiliateDailySeries(
  db: D1Database,
  fromTs: string,
  toTs: string,
): Promise<ConversionAggRow[]> {
  const vertCase = verticalCaseExpr();
  const result = await db
    .prepare(
      `SELECT date(cv.attributed_at, 'unixepoch') AS day,
              ${vertCase} AS vertical,
              SUM(cv.commission_usd) AS revenue
       FROM conversion_events cv
       JOIN affiliate_links al ON al.id = cv.link_id
       JOIN affiliate_offers ao ON ao.id = al.offer_id
       LEFT JOIN affiliate_networks an ON an.id = ao.network_id
       WHERE cv.status IN ('approved', 'paid')
         AND cv.attributed_at >= unixepoch(?)
         AND cv.attributed_at <= unixepoch(?)
       GROUP BY day, vertical`,
    )
    .bind(fromTs, toTs)
    .all<ConversionAggRow>();
  return result.results ?? [];
}

// ── Build zero-filled date series ─────────────────────────────────────────────

function buildDateSeries(
  days: number,
  toDate: Date,
): string[] {
  const series: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(toDate);
    d.setDate(d.getDate() - i);
    series.push(d.toISOString().slice(0, 10));
  }
  return series;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Aggregate unified revenue (saas + crypto + product) by day for a period.
 * Returns zero-filled daily series for the requested window.
 */
export async function fetchUnifiedRevenue(
  periodDays: 7 | 30 | 90,
): Promise<UnifiedRevenueSummary> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const toDate = new Date();
  const fromDate = new Date(toDate);
  fromDate.setDate(fromDate.getDate() - periodDays + 1);
  fromDate.setHours(0, 0, 0, 0);

  const fromIso = fromDate.toISOString().slice(0, 10);
  const toIso = toDate.toISOString().slice(0, 10);

  const [saasDayMap, affiliateRows] = await Promise.all([
    fetchSaasDailySeries(db, fromIso + 'T00:00:00.000Z', toIso + 'T23:59:59.999Z'),
    fetchAffiliateDailySeries(db, fromIso, toIso),
  ]);

  // Build affiliate maps by vertical
  const affiliateByDayVertical = new Map<string, number>();
  for (const row of affiliateRows) {
    const key = `${row.day}::${row.vertical}`;
    affiliateByDayVertical.set(key, (affiliateByDayVertical.get(key) ?? 0) + (row.revenue ?? 0));
  }

  // Zero-fill daily series
  const dates = buildDateSeries(periodDays, toDate);
  const dailySeries: DailyVerticalRevenue[] = dates.map(date => {
    const saas = saasDayMap.get(date) ?? 0;
    const crypto = affiliateByDayVertical.get(`${date}::crypto`) ?? 0;
    const product = affiliateByDayVertical.get(`${date}::product`) ?? 0;
    return { date, saas, crypto, product, total: saas + crypto + product };
  });

  // Totals
  let totalSaas = 0, totalCrypto = 0, totalProduct = 0;
  for (const row of dailySeries) {
    totalSaas += row.saas;
    totalCrypto += row.crypto;
    totalProduct += row.product;
  }

  const totalThisMonth = totalSaas + totalCrypto + totalProduct;

  return {
    totalThisMonth,
    byVertical: { saas: totalSaas, crypto: totalCrypto, product: totalProduct },
    dailySeries,
    periodDays,
  };
}
