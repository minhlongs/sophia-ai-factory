/**
 * SQL query helpers and date series builders for land unified revenue analytics.
 * @module land/analytics/queries/revenue-unified-helpers
 */

/** Network slugs that map to crypto vertical */
const CRYPTO_SLUGS = ['binance', 'coinbase', 'bybit', 'kucoin', 'okx', 'gate', 'bitget'];

function verticalCaseExpr(): string {
  const cryptoList = CRYPTO_SLUGS.map((s) => `'${s}'`).join(',');
  return `CASE
    WHEN an.slug IN (${cryptoList}) THEN 'crypto'
    ELSE 'product'
  END`;
}

export interface ConversionAggRow {
  day: string;
  vertical: string;
  revenue: number;
}

export async function fetchSaasDailySeries(
  db: D1Database,
  fromTs: string,
  toTs: string,
): Promise<Map<string, number>> {
  const dayMap = new Map<string, number>();

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
    } catch {
      /* skip malformed payload */
    }
  }

  return dayMap;
}

export async function fetchAffiliateDailySeries(
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

export function buildDateSeries(days: number, toDate: Date): string[] {
  const series: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(toDate);
    d.setDate(d.getDate() - i);
    series.push(d.toISOString().slice(0, 10));
  }
  return series;
}
