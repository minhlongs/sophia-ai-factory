/**
 * Unified Revenue Query — D1 SQL aggregations by vertical x date.
 * @module lib/analytics/queries/revenue-unified-query
 */

import { getD1 } from '@/seed/db/client';
import {
  fetchSaasDailySeries,
  fetchAffiliateDailySeries,
  buildDateSeries,
} from './revenue-unified-helpers';

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

  const affiliateByDayVertical = new Map<string, number>();
  for (const row of affiliateRows) {
    const key = `${row.day}::${row.vertical}`;
    affiliateByDayVertical.set(key, (affiliateByDayVertical.get(key) ?? 0) + (row.revenue ?? 0));
  }

  const dates = buildDateSeries(periodDays, toDate);
  const dailySeries: DailyVerticalRevenue[] = dates.map((date) => {
    const saas = saasDayMap.get(date) ?? 0;
    const crypto = affiliateByDayVertical.get(`${date}::crypto`) ?? 0;
    const product = affiliateByDayVertical.get(`${date}::product`) ?? 0;
    return { date, saas, crypto, product, total: saas + crypto + product };
  });

  let totalSaas = 0;
  let totalCrypto = 0;
  let totalProduct = 0;
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
