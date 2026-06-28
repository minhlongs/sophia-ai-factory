/**
 * Usage Export Types
 * @module usage-export/types
 */

import type { UsageEventRow } from '@/tree/database/supabase-types';

export type BillingPeriod = 'weekly' | 'monthly' | 'custom';
export type ExportFormat = 'json' | 'csv';

export interface UsageExportRequest {
  billingPeriod: BillingPeriod;
  format: ExportFormat;
  customerId?: string | null;
  startDate?: number | null;
  endDate?: number | null;
  service?: string | null;
  licenseNonce?: string | null;
}

export interface UsageExportRecord {
  id: string;
  tenant_id: string;
  feature_key: string;
  quantity: number;
  timestamp: number;
  license_nonce: string;
  service: string;
  action: string;
  tokens_input: number;
  tokens_output: number;
  request_count: number;
  status: 'success' | 'error';
  response_time_ms: number | null;
  external_customer_id: string | null;
}

export interface UsageExportSummary {
  totalRequests: number;
  totalCredits: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCostUsd?: number | null;
  byService: Record<string, { requests: number; credits: number; tokensInput: number; tokensOutput: number }>;
  byDay?: Record<number, { requests: number; credits: number }>;
}

export interface ExportPagination {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalRecords: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UsageExportResponse {
  metadata: {
    exportedAt: string;
    format: ExportFormat;
    billingPeriod: BillingPeriod;
    periodStart: number;
    periodEnd: number;
    filters: { customerId?: string | null; service?: string | null; licenseNonce?: string | null };
  };
  summary: UsageExportSummary;
  records: UsageExportRecord[];
  pagination: ExportPagination | null;
}

export type UsageEventDatabaseRow = UsageEventRow;

export interface UsageExportQueryParams {
  start: string;
  end: string;
  format?: ExportFormat;
  service?: string;
  license_nonce?: string;
  customer_id?: string;
  page?: string;
  page_size?: string;
}
