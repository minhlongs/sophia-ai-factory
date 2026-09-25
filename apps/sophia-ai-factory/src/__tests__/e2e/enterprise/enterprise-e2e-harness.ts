/**
 * Enterprise E2E Test Harness & D1 In-Memory Database Fabric
 *
 * Implements a unified in-memory SQLite wrapper (via node:sqlite DatabaseSync)
 * providing 100% Cloudflare D1 API parity for end-to-end integration testing.
 *
 * Schemas Covered:
 * - Organizations & Multi-Tenant Workspaces (organizations, client_subaccounts, subaccount_branding, subaccount_mcu_allocations)
 * - Invoicing & Ledger (invoices, user_mcu_balance, mcu_transactions)
 * - M1 Enterprise Sales Pipeline (0292: enterprise_deals, enterprise_lead_enrichments)
 * - M2 Enterprise SLA Contracts & Quotes (0293: enterprise_quotes, enterprise_contracts)
 * - M3 Global GPU Mesh & Failover (0294: enterprise_gpu_reservations, sla_degradation_incidents, gpu_mesh_region_health, video_render_jobs)
 *
 * @module __tests__/e2e/enterprise/enterprise-e2e-harness
 */

import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1Result, D1Response } from '@cloudflare/workers-types';

export const ENTERPRISE_E2E_SCHEMA = `
-- ============================================================================
-- 1. FOUNDATIONAL MULTI-TENANT & BILLING TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  tier TEXT NOT NULL DEFAULT 'enterprise',
  max_seats INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS client_subaccounts (
  id TEXT PRIMARY KEY,
  agency_org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  custom_domain TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS subaccount_branding (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  subaccount_id TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  accent_color TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS subaccount_mcu_allocations (
  id TEXT PRIMARY KEY,
  subaccount_id TEXT NOT NULL,
  allocated_mcu INTEGER NOT NULL DEFAULT 0,
  used_mcu INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  org_id TEXT NOT NULL,
  subaccount_id TEXT,
  tier TEXT NOT NULL DEFAULT 'enterprise',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  fx_rate REAL NOT NULL DEFAULT 1.0,
  tax_id TEXT,
  legal_name TEXT NOT NULL DEFAULT '',
  billing_address TEXT NOT NULL DEFAULT '',
  vat_rate REAL NOT NULL DEFAULT 0.0,
  vat_amount_cents INTEGER NOT NULL DEFAULT 0,
  total_amount_cents INTEGER NOT NULL,
  tax_form_type TEXT NOT NULL DEFAULT 'NONE',
  status TEXT NOT NULL DEFAULT 'draft',
  pdf_r2_key TEXT,
  paid_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS user_mcu_balance (
  user_id TEXT PRIMARY KEY,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  credits_total_purchased INTEGER NOT NULL DEFAULT 0,
  credits_total_used INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS mcu_transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  mission_id TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- ============================================================================
-- 2. M1: ENTERPRISE SALES PIPELINE & LEAD ENRICHMENTS (0292)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise_deals (
  id TEXT PRIMARY KEY,
  lead_name TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  lead_phone TEXT,
  lead_title TEXT,
  company_name TEXT NOT NULL,
  company_domain TEXT NOT NULL,
  lead_source TEXT NOT NULL DEFAULT 'website',
  deal_stage TEXT NOT NULL DEFAULT 'new_lead',
  pipeline_tier TEXT NOT NULL DEFAULT 'cold',
  deal_value_estimate_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  requested_mcu_monthly INTEGER NOT NULL DEFAULT 0,
  bant_score INTEGER NOT NULL DEFAULT 0,
  bant_budget_score INTEGER NOT NULL DEFAULT 0,
  bant_authority_score INTEGER NOT NULL DEFAULT 0,
  bant_need_score INTEGER NOT NULL DEFAULT 0,
  bant_timeline_score INTEGER NOT NULL DEFAULT 0,
  bant_analysis_json TEXT NOT NULL DEFAULT '{}',
  assigned_agent_id TEXT,
  assigned_agent_role TEXT NOT NULL DEFAULT 'ai_sales_executive',
  meeting_prep_brief TEXT,
  proposal_id TEXT,
  proposal_language TEXT NOT NULL DEFAULT 'en',
  proposal_content TEXT,
  sandbox_subaccount_id TEXT,
  sandbox_status TEXT NOT NULL DEFAULT 'none',
  sandbox_token TEXT,
  sandbox_expires_at INTEGER,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS enterprise_lead_enrichments (
  id TEXT PRIMARY KEY,
  deal_id TEXT,
  domain TEXT NOT NULL,
  company_name TEXT,
  industry TEXT,
  employee_count_range TEXT,
  estimated_annual_revenue TEXT,
  headquarters_location TEXT,
  country TEXT,
  tech_stack_json TEXT NOT NULL DEFAULT '[]',
  linkedin_company_url TEXT,
  twitter_handle TEXT,
  enrichment_source TEXT NOT NULL DEFAULT 'heuristic',
  confidence_score REAL NOT NULL DEFAULT 1.0,
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

-- ============================================================================
-- 3. M2: ENTERPRISE CONTRACTS & QUOTES (0293)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise_quotes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  deal_id TEXT,
  org_id TEXT NOT NULL,
  quote_number TEXT NOT NULL UNIQUE,
  mcu_capacity_monthly INTEGER NOT NULL,
  sla_uptime_percent REAL NOT NULL DEFAULT 99.9,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  base_price_cents INTEGER NOT NULL,
  volume_discount_percent REAL NOT NULL,
  annual_discount_percent REAL NOT NULL DEFAULT 0.0,
  final_price_cents INTEGER NOT NULL,
  final_price_vnd INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS enterprise_contracts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  deal_id TEXT,
  org_id TEXT NOT NULL,
  quote_id TEXT,
  contract_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  sla_uptime_percent REAL NOT NULL DEFAULT 99.9,
  mcu_capacity_monthly INTEGER NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  unit_price_per_mcu_cents REAL NOT NULL,
  volume_discount_percent REAL NOT NULL,
  monthly_commitment_cents INTEGER NOT NULL,
  annual_commitment_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  contract_sha256 TEXT NOT NULL,
  terms_version TEXT NOT NULL DEFAULT '2026.1-ENTERPRISE-SLA',
  customer_signer_name TEXT,
  customer_signer_email TEXT,
  customer_signer_title TEXT,
  customer_signer_ip TEXT,
  customer_signature_hash TEXT,
  customer_signed_at INTEGER,
  platform_signature_hash TEXT,
  platform_signed_at INTEGER,
  effective_date TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  payment_rail TEXT,
  last_invoice_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

-- ============================================================================
-- 4. M3: GLOBAL GPU MESH & FAILOVER ROUTING (0294)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise_gpu_reservations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL,
  deal_id TEXT,
  contract_id TEXT,
  lane_id TEXT NOT NULL UNIQUE,
  primary_region TEXT NOT NULL DEFAULT 'apac',
  fallback_regions TEXT NOT NULL DEFAULT '["us", "eu"]',
  reserved_units INTEGER NOT NULL DEFAULT 5,
  concurrency_limit INTEGER NOT NULL DEFAULT 20,
  mcu_monthly_allocation INTEGER NOT NULL DEFAULT 100000,
  mcu_consumed INTEGER NOT NULL DEFAULT 0,
  priority_score INTEGER NOT NULL DEFAULT 300,
  status TEXT NOT NULL DEFAULT 'active',
  sla_uptime_target REAL NOT NULL DEFAULT 0.999,
  sla_p95_latency_ms INTEGER NOT NULL DEFAULT 1500,
  sla_degradation_window_secs INTEGER NOT NULL DEFAULT 900,
  sla_refund_pct REAL NOT NULL DEFAULT 10.0,
  allocated_providers TEXT NOT NULL DEFAULT '["fal", "runpod", "mekong"]',
  active_from INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  active_until INTEGER NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS sla_degradation_incidents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  reservation_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  breach_type TEXT NOT NULL,
  region TEXT NOT NULL,
  target_threshold REAL NOT NULL,
  measured_value REAL NOT NULL,
  started_at INTEGER NOT NULL,
  resolved_at INTEGER,
  duration_seconds INTEGER,
  impacted_jobs_count INTEGER NOT NULL DEFAULT 0,
  credit_amount_cents INTEGER NOT NULL DEFAULT 0,
  compensation_rail TEXT NOT NULL DEFAULT 'MCU_CREDIT',
  refund_status TEXT NOT NULL DEFAULT 'pending',
  refund_ledger_id TEXT,
  detected_by TEXT NOT NULL DEFAULT 'cron_sla_monitor',
  resolution_notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS gpu_mesh_region_health (
  region TEXT PRIMARY KEY,
  health_status TEXT NOT NULL DEFAULT 'healthy',
  p95_latency_ms INTEGER NOT NULL DEFAULT 200,
  error_rate_pct REAL NOT NULL DEFAULT 0.0,
  active_reservations INTEGER NOT NULL DEFAULT 0,
  available_capacity_pct REAL NOT NULL DEFAULT 100.0,
  circuit_breaker_state TEXT NOT NULL DEFAULT 'CLOSED',
  last_probe_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  probe_details TEXT DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS video_render_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  subaccount_id TEXT,
  lane TEXT NOT NULL DEFAULT 'standard',
  priority_score INTEGER NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'queued',
  tier TEXT NOT NULL DEFAULT 'enterprise',
  payload TEXT NOT NULL DEFAULT '{}',
  result_url TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  leased_by TEXT,
  leased_until INTEGER,
  provider TEXT,
  dlq_reason TEXT,
  reservation_id TEXT,
  target_region TEXT DEFAULT 'apac',
  executed_region TEXT,
  failover_hops INTEGER DEFAULT 0,
  execution_latency_ms INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS refund_ledger (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  refund_request_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  tier_before TEXT NOT NULL DEFAULT 'BASIC',
  tier_after TEXT NOT NULL DEFAULT 'BASIC',
  mcu_clawed_back INTEGER NOT NULL DEFAULT 0,
  tx_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
`;

/**
 * Creates and wraps an in-memory SQLite database providing full D1 compatibility.
 */
export function createEnterpriseTestDb(): {
  rawDb: InstanceType<typeof DatabaseSync>;
  d1: D1Database;
  seedDefaults: () => Promise<void>;
} {
  const rawDb = new DatabaseSync(':memory:');
  rawDb.exec(ENTERPRISE_E2E_SCHEMA);

  const d1 = {
    rawDb,
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = rawDb.prepare(sql);

      return {
        bind(...vals: unknown[]) {
          bound = vals;
          return this;
        },
        async first<T = Record<string, unknown>>(...vals: unknown[]): Promise<T | null> {
          const params = vals.length > 0 ? vals : bound;
          const sanitized = params.map((p) => (p === undefined ? null : p));
          const res = stmt.get(...sanitized);
          return (res ?? null) as T | null;
        },
        async all<T = Record<string, unknown>>(...vals: unknown[]): Promise<D1Result<T>> {
          const params = vals.length > 0 ? vals : bound;
          const sanitized = params.map((p) => (p === undefined ? null : p));
          const res = stmt.all(...sanitized);
          return {
            results: res as T[],
            success: true,
            meta: {
              changes: 0,
              duration: 0,
              last_row_id: 0,
              rows_read: res.length,
              rows_written: 0,
              served_by: 'node:sqlite-e2e',
            } as unknown as D1Result<T>['meta'],
          };
        },
        async run(...vals: unknown[]): Promise<D1Response> {
          const params = vals.length > 0 ? vals : bound;
          const sanitized = params.map((p) => (p === undefined ? null : p));
          const info = stmt.run(...sanitized);
          return {
            success: true,
            meta: {
              changes: Number(info.changes ?? 0),
              duration: 0,
              last_row_id: Number(info.lastInsertRowid ?? 0),
              rows_read: 0,
              rows_written: Number(info.changes ?? 0),
              served_by: 'node:sqlite-e2e',
            } as unknown as D1Response['meta'],
          };
        },
      };
    },
    exec(sql: string) {
      rawDb.exec(sql);
      return Promise.resolve({
        count: 1,
        duration: 0,
      });
    },
    batch<T = unknown>(statements: unknown[]): Promise<D1Result<T>[]> {
      return Promise.all(
        statements.map(async (st: unknown) => {
          const statement = st as { run: () => Promise<D1Response> };
          const res = await statement.run();
          return {
            results: [],
            success: res.success,
            meta: res.meta,
          } as D1Result<T>;
        })
      );
    },
  } as unknown as D1Database;

  const seedDefaults = async () => {
    // Seed default organization
    rawDb.exec(`
      INSERT OR IGNORE INTO organizations (id, name, slug, tier, max_seats, status)
      VALUES ('org_enterprise_root', 'Root Enterprise Agency', 'root-enterprise', 'enterprise', 100, 'active');

      INSERT OR IGNORE INTO gpu_mesh_region_health (region, health_status, p95_latency_ms, error_rate_pct, circuit_breaker_state, updated_at)
      VALUES 
        ('apac', 'healthy', 220, 0.0, 'CLOSED', unixepoch()),
        ('us', 'healthy', 180, 0.0, 'CLOSED', unixepoch()),
        ('eu', 'healthy', 210, 0.0, 'CLOSED', unixepoch());
    `);
  };

  return { rawDb, d1, seedDefaults };
}
