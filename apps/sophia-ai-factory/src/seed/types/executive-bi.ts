/**
 * Executive Business Intelligence (BI) & Analytical Models — Seed Type Definitions
 *
 * Layer: seed/types (Foundational primitives)
 * Dependencies: None (zero internal framework dependencies)
 *
 * @module seed/types/executive-bi
 */

export interface DateRange {
  start: number; // epoch ms (inclusive)
  end: number;   // epoch ms (inclusive)
}

export interface ExecutiveBIMetricsSummary {
  orgId: string;
  periodStart: number;
  periodEnd: number;
  mrrCents: number;
  throughputCount: number;
  viralScore: number;
  affiliateRevenueCents: number;
  marketingSpendCents: number;
  roiRatio: number;
}

export interface ExecutiveBIMetricRow {
  id: string;
  org_id: string;
  period_start: number;
  period_end: number;
  mrr_cents: number;
  throughput_count: number;
  viral_score: number;
  affiliate_revenue_cents: number;
  marketing_spend_cents: number;
  channel?: string | null;
  created_at: number;
}

export interface ExecutiveBIMetricRecord {
  id: string;
  orgId: string;
  periodStart: number;
  periodEnd: number;
  mrrCents: number;
  throughputCount: number;
  viralScore: number;
  affiliateRevenueCents: number;
  marketingSpendCents: number;
  channel?: string | null;
  createdAt: number;
}

export interface CreateExecutiveBIMetricInput {
  id?: string;
  orgId: string;
  periodStart: number;
  periodEnd: number;
  mrrCents: number;
  throughputCount: number;
  viralScore: number;
  affiliateRevenueCents: number;
  marketingSpendCents: number;
  channel?: string | null;
  createdAt?: number;
}

export type ExecutiveBIExportFormat = 'csv' | 'json' | 'ndjson';

export interface ExecutiveBIExportOptions {
  format: ExecutiveBIExportFormat;
  dateRange: DateRange;
  channel?: string;
  filename?: string;
}

export type ExecutiveBIErrorCode =
  | 'INVALID_DATE_RANGE'
  | 'ORGANIZATION_REQUIRED'
  | 'CROSS_TENANT_VIOLATION'
  | 'DB_UNAVAILABLE'
  | 'RECORD_CREATION_FAILED'
  | 'QUERY_EXECUTION_FAILED';

export interface ExecutiveBIError {
  code: ExecutiveBIErrorCode;
  message: string;
  details?: unknown;
}
