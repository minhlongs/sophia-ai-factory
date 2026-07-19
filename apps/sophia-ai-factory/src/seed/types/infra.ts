/**
 * Infrastructure Domain Types
 *
 * Database row types for rate limiting, usage summaries.
 * Extracted from supabase-types.ts for modular organization.
 *
 * @module seed/types/infra
 */

import { Json } from './json';

// Generic rate limiting
export interface RateLimitRow {
  id?: string;
  identifier: string;
  window_start: string;
  request_count: number;
  created_at?: string;
}

// Telegram command rate limiting
export interface TelegramRateLimitRow {
  id?: string;
  telegram_chat_id: string;
  command_timestamp: string;
  command_type?: string | null;
  created_at?: string;
}

// Hourly usage summaries (for rollup analytics)
export interface UsageHourlySummaryRow {
  id?: string;
  hour_timestamp: number;
  tenant_id: string;
  license_nonce: string;
  external_customer_id: string | null;
  total_requests: number;
  total_credits: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_errors: number;
  avg_response_time_ms: number;
  service_breakdown: Json;
  created_at?: string;
  updated_at?: string;
}

export interface UsageHourlySummaryInsert {
  hour_timestamp: number;
  tenant_id: string;
  license_nonce: string;
  external_customer_id?: string | null;
  total_requests?: number;
  total_credits?: number;
  total_tokens_input?: number;
  total_tokens_output?: number;
  total_errors?: number;
  avg_response_time_ms?: number;
  service_breakdown?: Json;
}

// Daily usage summaries
export interface UsageDailySummaryRow {
  id?: string;
  day_timestamp: number;
  tenant_id: string;
  license_nonce: string;
  external_customer_id: string | null;
  total_requests: number;
  total_credits: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_errors: number;
  avg_response_time_ms: number;
  hourly_breakdown: Json;
  service_breakdown: Json;
  created_at?: string;
  updated_at?: string;
}

export interface UsageDailySummaryInsert {
  day_timestamp: number;
  tenant_id: string;
  license_nonce: string;
  external_customer_id?: string | null;
  total_requests?: number;
  total_credits?: number;
  total_tokens_input?: number;
  total_tokens_output?: number;
  total_errors?: number;
  avg_response_time_ms?: number;
  hourly_breakdown?: Json;
  service_breakdown?: Json;
}

// Quota usage tracking (window-based)
export interface UsageQuotaUsageRow {
  id?: string;
  window_type: 'hourly' | 'daily' | 'monthly';
  window_start: number;
  window_end: number;
  tenant_id: string;
  license_nonce: string;
  tier: string;
  credits_used: number;
  requests_used: number;
  credit_limit: number;
  request_limit: number;
  created_at?: string;
}

export interface UsageQuotaUsageInsert {
  window_type: 'hourly' | 'daily' | 'monthly';
  window_start: number;
  window_end: number;
  tenant_id: string;
  license_nonce: string;
  tier: string;
  credits_used?: number;
  requests_used?: number;
  credit_limit: number;
  request_limit: number;
}
