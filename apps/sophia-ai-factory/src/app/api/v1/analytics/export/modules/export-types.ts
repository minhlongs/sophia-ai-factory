export interface ExportQueryParams {
  format?: string | null;
  start?: string | null;
  end?: string | null;
  category?: string | null;
  orgId?: string | null;
}

export const DEFAULT_HEADERS = [
  'id',
  'org_id',
  'period_start',
  'period_end',
  'mrr_usd',
  'throughput',
  'viral_score',
  'affiliate_revenue_usd',
  'marketing_spend_usd',
  'roi',
  'created_at',
];

export const SUMMARY_HEADERS = [
  'org_id',
  'period_start',
  'period_end',
  'peak_mrr_usd',
  'total_throughput',
  'average_viral_score',
  'total_affiliate_revenue_usd',
  'total_marketing_spend_usd',
  'roi_multiplier',
  'record_count',
];
