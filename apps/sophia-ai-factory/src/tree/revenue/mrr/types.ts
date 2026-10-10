import type {
  SnapshotStatus,
  UnifiedRevenueSnapshot,
} from '@/seed/types/unified-revenue';

export interface SnapshotDbRow {
  id: string;
  snapshot_timestamp: number;
  period_month: string;
  direct_sales_cents: number;
  affiliate_sales_cents: number;
  content_seo_cents: number;
  enterprise_deals_cents: number;
  total_mrr_cents: number;
  active_customers_count: number;
  arpu_cents: number;
  target_mrr_cents: number;
  target_customers_count: number;
  target_arpu_cents: number;
  channel_breakdown_json: string;
  currency: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export function mapRowToSnapshot(row: SnapshotDbRow): UnifiedRevenueSnapshot {
  return {
    id: row.id,
    snapshotTimestamp: Number(row.snapshot_timestamp),
    periodMonth: row.period_month,
    directSalesCents: Number(row.direct_sales_cents),
    affiliateSalesCents: Number(row.affiliate_sales_cents),
    contentSeoCents: Number(row.content_seo_cents),
    enterpriseDealsCents: Number(row.enterprise_deals_cents),
    totalMrrCents: Number(row.total_mrr_cents),
    activeCustomersCount: Number(row.active_customers_count),
    arpuCents: Number(row.arpu_cents),
    targetMrrCents: Number(row.target_mrr_cents),
    targetCustomersCount: Number(row.target_customers_count),
    targetArpuCents: Number(row.target_arpu_cents),
    channelBreakdownJson: row.channel_breakdown_json,
    currency: row.currency,
    status: row.status as SnapshotStatus,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}
