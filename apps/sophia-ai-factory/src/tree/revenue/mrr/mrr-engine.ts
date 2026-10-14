import type { D1Database } from '@cloudflare/workers-types';
import {
  type ConsolidateChannelsInput,
  type UnifiedRevenueSnapshot,
  GATE_8_CONSTANTS,
} from '@/seed/types/unified-revenue';
import { consolidateMrrChannels } from './cohort-aggregator';
import { getLatestUnifiedRevenueSnapshot } from './snapshot-store';
import { queryLiveMrrChannels } from './mrr-channel-queries';

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
  const {
    directSalesCents,
    enterpriseDealsCents,
    affiliateSalesCents,
    contentSeoCents,
    activeCustomersCount,
  } = await queryLiveMrrChannels(db);

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
