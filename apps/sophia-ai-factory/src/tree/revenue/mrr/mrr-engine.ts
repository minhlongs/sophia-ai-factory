import type { D1Database } from '@cloudflare/workers-types';
import {
  type ConsolidateChannelsInput,
  type UnifiedRevenueSnapshot,
  GATE_8_CONSTANTS,
} from '@/seed/types/unified-revenue';
import { consolidateMrrChannels } from './cohort-aggregator';
import { getLatestUnifiedRevenueSnapshot } from './snapshot-store';

/**
 * Persists a consolidated MRR snapshot into D1.
 */
export async function saveUnifiedRevenueSnapshot(
  db: D1Database,
  input: ConsolidateChannelsInput & { id?: string; snapshotTimestamp?: number },
): Promise<UnifiedRevenueSnapshot> {
  const consolidated = consolidateMrrChannels(input);
  const now = Date.now();
  const id = input.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rev_${now}_${Math.random().toString(36).substring(2, 9)}`);
  const snapshotTimestamp = input.snapshotTimestamp ?? now;
  const status = input.status ?? 'active';
  const currency = input.currency ?? 'USD';

  const stmt = db.prepare(`
    INSERT INTO unified_revenue_snapshots (
      id, snapshot_timestamp, period_month,
      direct_sales_cents, affiliate_sales_cents, content_seo_cents, enterprise_deals_cents,
      total_mrr_cents, active_customers_count, arpu_cents,
      target_mrr_cents, target_customers_count, target_arpu_cents,
      channel_breakdown_json, currency, status,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
  `);

  await stmt
    .bind(
      id,
      snapshotTimestamp,
      input.periodMonth,
      input.directSalesCents,
      input.affiliateSalesCents,
      input.contentSeoCents,
      input.enterpriseDealsCents,
      consolidated.totalMrrCents,
      input.activeCustomersCount,
      consolidated.arpuCents,
      GATE_8_CONSTANTS.TARGET_MRR_CENTS,
      GATE_8_CONSTANTS.TARGET_CUSTOMERS,
      GATE_8_CONSTANTS.TARGET_ARPU_CENTS,
      consolidated.channelBreakdownJson,
      currency,
      status,
      now,
      now,
    )
    .run();

  return {
    id,
    snapshotTimestamp,
    periodMonth: input.periodMonth,
    directSalesCents: input.directSalesCents,
    affiliateSalesCents: input.affiliateSalesCents,
    contentSeoCents: input.contentSeoCents,
    enterpriseDealsCents: input.enterpriseDealsCents,
    totalMrrCents: consolidated.totalMrrCents,
    activeCustomersCount: input.activeCustomersCount,
    arpuCents: consolidated.arpuCents,
    targetMrrCents: GATE_8_CONSTANTS.TARGET_MRR_CENTS,
    targetCustomersCount: GATE_8_CONSTANTS.TARGET_CUSTOMERS,
    targetArpuCents: GATE_8_CONSTANTS.TARGET_ARPU_CENTS,
    channelBreakdownJson: consolidated.channelBreakdownJson,
    currency,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Real-time MRR aggregation query from D1.
 */
export async function aggregateRealtimeMrrFromD1(
  db: D1Database,
  periodMonth: string,
): Promise<UnifiedRevenueSnapshot> {
  let directSalesCents = 0;
  let enterpriseDealsCents = 0;
  let affiliateSalesCents = 0;
  let contentSeoCents = 0;
  let activeCustomersCount = 0;

  // 1. Direct Sales & Subscriptions
  try {
    const subRow = await db
      .prepare(`
        SELECT
          COALESCE(SUM(current_mrr_cents), 0) AS total_direct_cents,
          COUNT(DISTINCT user_id) AS direct_cust_count
        FROM subscriptions
        WHERE status IN ('active', 'trialing')
      `)
      .first<{ total_direct_cents: number; direct_cust_count: number }>();

    if (subRow) {
      directSalesCents = Number(subRow.total_direct_cents || 0);
      activeCustomersCount += Number(subRow.direct_cust_count || 0);
    }
  } catch {
    // subscriptions table may not be populated in isolated test environments
  }

  // 2. Enterprise B2B Deals
  try {
    const dealRow = await db
      .prepare(`
        SELECT
          COALESCE(SUM(mrr_cents), 0) AS total_deal_cents,
          COUNT(DISTINCT id) AS deal_cust_count
        FROM enterprise_deals
        WHERE stage = 'closed_won'
      `)
      .first<{ total_deal_cents: number; deal_cust_count: number }>();

    if (dealRow) {
      enterpriseDealsCents = Number(dealRow.total_deal_cents || 0);
      activeCustomersCount += Number(dealRow.deal_cust_count || 0);
    }
  } catch {
    // enterprise_deals table fallback
  }

  // 3. Affiliate / Partner Commissions Net Margin
  try {
    const affiliateRow = await db
      .prepare(`
        SELECT
          COALESCE(SUM(mrr_cents), 0) AS total_affiliate_cents,
          COUNT(DISTINCT referred_user_id) AS affiliate_cust_count
        FROM partner_commissions
        WHERE status IN ('approved', 'paid')
      `)
      .first<{ total_affiliate_cents: number; affiliate_cust_count: number }>();

    if (affiliateRow) {
      affiliateSalesCents = Number(affiliateRow.total_affiliate_cents || 0);
      activeCustomersCount += Number(affiliateRow.affiliate_cust_count || 0);
    }
  } catch {
    // partner_commissions fallback
  }

  // 4. Content SEO Organic Conversions
  try {
    const seoRow = await db
      .prepare(`
        SELECT
          COALESCE(SUM(amount_cents), 0) AS total_seo_cents,
          COUNT(DISTINCT user_id) AS seo_cust_count
        FROM user_purchases
        WHERE attribution_source = 'content_seo'
      `)
      .first<{ total_seo_cents: number; seo_cust_count: number }>();

    if (seoRow) {
      contentSeoCents = Number(seoRow.total_seo_cents || 0);
      activeCustomersCount += Number(seoRow.seo_cust_count || 0);
    }
  } catch {
    // user_purchases fallback
  }

  // If live tables have zero records, check for existing snapshot
  if (directSalesCents === 0 && enterpriseDealsCents === 0 && affiliateSalesCents === 0) {
    const latest = await getLatestUnifiedRevenueSnapshot(db);
    if (latest && latest.periodMonth === periodMonth) {
      return latest;
    }
  }

  return saveUnifiedRevenueSnapshot(db, {
    periodMonth,
    directSalesCents,
    affiliateSalesCents,
    contentSeoCents,
    enterpriseDealsCents,
    activeCustomersCount,
    status: 'active',
  });
}
