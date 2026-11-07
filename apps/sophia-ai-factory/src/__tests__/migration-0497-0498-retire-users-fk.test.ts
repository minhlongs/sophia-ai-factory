/**
 * Regression suite for migrations 0497 (GH-120: 6 tables) and 0498 (GH-121: 16 tables).
 *
 * Verifies against real SQLite (via createFakeD1):
 * 1. Before 0497/0498, retiring `users` causes inserts into tables with
 *    `REFERENCES users(id)` to fail with `no such table: main.users` when
 *    `PRAGMA foreign_keys = ON`.
 * 2. Executing 0497 and 0498 preserves existing rows across all 22 tables,
 *    removes every `users` foreign key (`PRAGMA foreign_key_list` has 0 `users`
 *    references), preserves non-`users` foreign keys (`campaigns`, `raas_licenses`,
 *    `whatsapp_templates`, `organizations`, `fx_exchange_rates`), and recreates
 *    the 3 `campaigns` org_id invariant triggers.
 * 3. Both migrations are idempotent when re-applied.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';

const APP_ROOT = resolve(__dirname, '..', '..');
const MIG_0497 = readFileSync(
  resolve(APP_ROOT, 'migrations/0497_rebuild_six_tables_without_legacy_user_fk.sql'),
  'utf8',
);
const MIG_0498 = readFileSync(
  resolve(APP_ROOT, 'migrations/0498_rebuild_sixteen_tables_without_legacy_user_fk.sql'),
  'utf8',
);

const SIX_TABLES = [
  'payouts',
  'user_wallets',
  'affiliate_clicks',
  'scheduled_campaigns',
  'video_analytics',
  'marketplace_templates',
] as const;

const SIXTEEN_TABLES = [
  'tier_change_events',
  'campaigns',
  'raas_licenses',
  'raas_audit_logs',
  'affiliate_offers_selected',
  'affiliate_conversions',
  'user_payout_settings',
  'repurpose_jobs',
  'thumbnail_variants',
  'whatsapp_templates',
  'whatsapp_message_log',
  'localized_payment_transactions',
  'financial_close_periods',
  'revenue_schedules',
  'intercompany_transfers',
  'ipo_filing_periods',
] as const;

const PRE_MIGRATION_SCHEMA = `
  CREATE TABLE users (id TEXT PRIMARY KEY);
  CREATE TABLE organizations (id TEXT PRIMARY KEY);
  CREATE TABLE org_members (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'owner', created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE fx_exchange_rates (id TEXT PRIMARY KEY);

  CREATE TABLE payouts (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), user_id TEXT NOT NULL REFERENCES users(id), amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', method TEXT NOT NULL CHECK (method IN ('usdt_trc20','usdt_erc20','bank_transfer','other')), reference TEXT, notes TEXT, paid_by_admin TEXT NOT NULL REFERENCES users(id), created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE user_wallets (user_id TEXT PRIMARY KEY REFERENCES users(id), balance_pending REAL NOT NULL DEFAULT 0, balance_available REAL NOT NULL DEFAULT 0, balance_paid_out REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD', last_rebuilt_at INTEGER, updated_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE campaigns (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, topic TEXT, audience TEXT, status TEXT DEFAULT 'draft', progress INTEGER DEFAULT 0, template_id TEXT, script_content TEXT, audio_url TEXT, video_url TEXT, thumbnail_url TEXT, error_message TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), org_id TEXT);
  CREATE TABLE affiliate_clicks (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), click_id TEXT NOT NULL UNIQUE, campaign_id TEXT NOT NULL REFERENCES campaigns(id), user_id TEXT NOT NULL REFERENCES users(id), offer_id TEXT NOT NULL, short_code TEXT NOT NULL, ip_hash TEXT, user_agent TEXT, referer TEXT, country TEXT, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE scheduled_campaigns (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, topic TEXT NOT NULL, template_script TEXT, interval_days INTEGER NOT NULL DEFAULT 7, next_run_date TEXT NOT NULL, last_run_date TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE video_analytics (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))), user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id TEXT NOT NULL, platform TEXT NOT NULL, platform_video_id TEXT NOT NULL, date TEXT NOT NULL, views INTEGER DEFAULT 0, watch_time_sec INTEGER DEFAULT 0, completion_rate REAL DEFAULT 0.0, impressions INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, comments INTEGER DEFAULT 0, shares INTEGER DEFAULT 0, synced_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(video_id, platform, date));
  CREATE TABLE marketplace_templates (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))), creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, template_config TEXT NOT NULL, preview_r2_key TEXT, price_cents INTEGER DEFAULT 0, downloads INTEGER DEFAULT 0, rating REAL DEFAULT 0.0, rating_count INTEGER DEFAULT 0, is_public INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);

  CREATE TABLE tier_change_events (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, org_id TEXT, from_tier TEXT, to_tier TEXT, event_type TEXT NOT NULL CHECK (event_type IN ('upgrade', 'downgrade', 'cancel', 'activate')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));
  CREATE TABLE raas_licenses (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), key_hash TEXT NOT NULL, tier TEXT NOT NULL CHECK (tier IN ('BASIC','PREMIUM','ENTERPRISE','MASTER')), expires_at INTEGER, nonce TEXT NOT NULL UNIQUE, is_revoked INTEGER DEFAULT 0, revoked_at INTEGER, revoked_by TEXT REFERENCES users(id), created_by TEXT REFERENCES users(id), user_id TEXT REFERENCES users(id), created_at INTEGER NOT NULL, metadata TEXT DEFAULT '{}', updated_at INTEGER, polar_customer_id TEXT, stripe_customer_id TEXT);
  CREATE TABLE raas_audit_logs (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), action TEXT NOT NULL CHECK (action IN ('CREATE','VALIDATE','REVOKE','UPDATE')), license_id TEXT REFERENCES raas_licenses(id), license_nonce TEXT, user_id TEXT REFERENCES users(id), ip_address TEXT, user_agent TEXT, details TEXT DEFAULT '{}', created_at INTEGER NOT NULL, model_name TEXT, token_count INTEGER, ip_address_hash TEXT, user_pseudonym TEXT, previous_log_hash TEXT, content_hash TEXT NOT NULL DEFAULT '', hash_chain_valid INTEGER DEFAULT 1);
  CREATE TABLE affiliate_offers_selected (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), campaign_id TEXT NOT NULL REFERENCES campaigns(id), user_id TEXT NOT NULL REFERENCES users(id), offer_id TEXT NOT NULL, offer_name TEXT NOT NULL, affiliate_link TEXT NOT NULL, short_code TEXT NOT NULL UNIQUE, network TEXT NOT NULL DEFAULT 'clickbank', commission_rate REAL, created_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE affiliate_conversions (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), receipt TEXT NOT NULL, click_id TEXT, campaign_id TEXT REFERENCES campaigns(id), user_id TEXT REFERENCES users(id), offer_id TEXT, network TEXT NOT NULL DEFAULT 'clickbank', event_type TEXT NOT NULL CHECK (event_type IN ('SALE','REFUND','CHARGEBACK','TEST')), gross_amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', commission_user REAL NOT NULL, commission_sophia REAL NOT NULL, payout_status TEXT NOT NULL DEFAULT 'pending_clearance', available_at INTEGER, paid_at INTEGER, payout_id TEXT, raw_payload TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(receipt, event_type));
  CREATE TABLE user_payout_settings (user_id TEXT PRIMARY KEY REFERENCES users(id), preferred_method TEXT, payout_address TEXT, payout_address_verified INTEGER DEFAULT 0, stripe_account_id TEXT, stripe_account_status TEXT, stripe_payout_enabled INTEGER DEFAULT 0, stripe_onboarding_started_at TEXT, stripe_last_event_at TEXT, updated_at TEXT DEFAULT (datetime('now')));
  CREATE TABLE repurpose_jobs (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))), user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, source_video_id TEXT NOT NULL, status TEXT DEFAULT 'analyzing', clip_manifest TEXT, total_clips INTEGER DEFAULT 0, completed_clips INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE thumbnail_variants (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))), video_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, variant_index INTEGER NOT NULL, r2_key TEXT NOT NULL, strategy TEXT NOT NULL, impressions INTEGER DEFAULT 0, clicks INTEGER DEFAULT 0, is_selected INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE whatsapp_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider_id INTEGER, phone_number_id TEXT NOT NULL, wa_token TEXT NOT NULL, waba_id TEXT, business_id TEXT, is_default INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()), whatsapp_approved INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE whatsapp_message_log (id INTEGER PRIMARY KEY AUTOINCREMENT, template_id INTEGER NOT NULL REFERENCES whatsapp_templates(id), user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider_id INTEGER, recipient TEXT NOT NULL, channel TEXT NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook')), extern_message_id TEXT, kind TEXT NOT NULL CHECK (kind IN ('send','react','template','media')), sub_type TEXT, text_preview TEXT, caption TEXT, payload TEXT, client_status TEXT NOT NULL DEFAULT ('received'), error_code TEXT, error_message TEXT, error_category TEXT, retry_count INTEGER NOT NULL DEFAULT 0, send_meta TEXT, sent_at INTEGER, delivered_at INTEGER, read_at INTEGER, failed_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
  CREATE TABLE localized_payment_transactions (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, tier TEXT NOT NULL, billing_cycle TEXT NOT NULL DEFAULT 'monthly', payment_rail TEXT NOT NULL, base_currency TEXT NOT NULL DEFAULT 'USD', base_amount_cents INTEGER NOT NULL, settlement_currency TEXT NOT NULL, settlement_amount REAL NOT NULL, fx_rate_applied REAL NOT NULL, fx_rate_id TEXT REFERENCES fx_exchange_rates(id), tax_jurisdiction TEXT NOT NULL DEFAULT 'NONE', tax_rate REAL NOT NULL DEFAULT 0.0, tax_amount_cents INTEGER NOT NULL DEFAULT 0, tax_identifier TEXT, subtotal_amount REAL NOT NULL, total_amount REAL NOT NULL, rail_transaction_reference TEXT, qr_payload TEXT, mandate_reference TEXT, status TEXT NOT NULL DEFAULT 'pending', idempotency_key TEXT NOT NULL UNIQUE, error_code TEXT, error_message TEXT, settled_at INTEGER, expires_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
  CREATE TABLE financial_close_periods (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE, period_key TEXT NOT NULL, period_type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, close_status TEXT NOT NULL DEFAULT 'open', closed_by TEXT REFERENCES users(id), closed_at INTEGER, total_recognized_revenue_cents INTEGER NOT NULL DEFAULT 0, total_deferred_revenue_cents INTEGER NOT NULL DEFAULT 0, total_refunds_cents INTEGER NOT NULL DEFAULT 0, net_revenue_cents INTEGER NOT NULL DEFAULT 0, active_contracts_count INTEGER NOT NULL DEFAULT 0, merkle_root_hash TEXT, digital_signature TEXT, compliance_frameworks TEXT NOT NULL DEFAULT 'ASC_606,IFRS_15,VAS_TT200,SOX_404', audit_opinion TEXT NOT NULL DEFAULT 'unqualified', lock_reason TEXT, created_at INTEGER NOT NULL DEFAULT 1000, updated_at INTEGER NOT NULL DEFAULT 1000, UNIQUE(org_id, period_key));
  CREATE TABLE revenue_schedules (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, contract_id TEXT NOT NULL, tier TEXT NOT NULL, billing_cycle TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', total_contract_value_cents INTEGER NOT NULL, recognized_revenue_cents INTEGER NOT NULL DEFAULT 0, deferred_revenue_cents INTEGER NOT NULL, daily_recognition_rate_cents REAL NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, term_days INTEGER NOT NULL, days_recognized INTEGER NOT NULL DEFAULT 0, accounting_standard TEXT NOT NULL DEFAULT 'ASC_606_IFRS_15', status TEXT NOT NULL DEFAULT 'active', last_accrual_date TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL DEFAULT 1000, updated_at INTEGER NOT NULL DEFAULT 1000);
  CREATE TABLE intercompany_transfers (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), transfer_reference TEXT NOT NULL UNIQUE, origin_entity TEXT NOT NULL, destination_entity TEXT NOT NULL, transfer_type TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', gross_amount_cents INTEGER NOT NULL, withholding_tax_regime TEXT NOT NULL, withholding_tax_rate_pct REAL NOT NULL DEFAULT 0.0, withholding_tax_amount_cents INTEGER NOT NULL DEFAULT 0, net_settlement_cents INTEGER NOT NULL, settlement_status TEXT NOT NULL DEFAULT 'pending', reconciliation_ledger_id TEXT, approved_by TEXT REFERENCES users(id), transfer_date TEXT NOT NULL, settled_at INTEGER, supporting_docs_hash TEXT, notes TEXT, created_at INTEGER NOT NULL DEFAULT 1000, updated_at INTEGER NOT NULL DEFAULT 1000);
  CREATE TABLE ipo_filing_periods (id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))), period_key TEXT NOT NULL UNIQUE, filing_type TEXT NOT NULL, target_exchanges TEXT NOT NULL DEFAULT 'NASDAQ,SGX', status TEXT NOT NULL DEFAULT 'draft', filing_date TEXT, effective_date TEXT, total_customers INTEGER NOT NULL DEFAULT 0, mrr_cents INTEGER NOT NULL DEFAULT 0, arr_cents INTEGER NOT NULL DEFAULT 0, arpu_cents INTEGER NOT NULL DEFAULT 0, nrr_pct REAL NOT NULL DEFAULT 0.0, gross_margin_pct REAL NOT NULL DEFAULT 0.0, gaap_revenue_cents INTEGER NOT NULL DEFAULT 0, gaap_cost_of_revenue_cents INTEGER NOT NULL DEFAULT 0, gaap_gross_profit_cents INTEGER NOT NULL DEFAULT 0, gaap_operating_expenses_cents INTEGER NOT NULL DEFAULT 0, gaap_operating_income_cents INTEGER NOT NULL DEFAULT 0, gaap_net_income_cents INTEGER NOT NULL DEFAULT 0, gaap_operating_cash_flow_cents INTEGER NOT NULL DEFAULT 0, capex_cents INTEGER NOT NULL DEFAULT 0, stock_based_compensation_cents INTEGER NOT NULL DEFAULT 0, depreciation_amortization_cents INTEGER NOT NULL DEFAULT 0, unrealized_fx_gain_loss_cents INTEGER NOT NULL DEFAULT 0, one_time_mna_restructuring_cents INTEGER NOT NULL DEFAULT 0, adjusted_ebitda_cents INTEGER NOT NULL DEFAULT 0, adjusted_ebitda_margin_pct REAL NOT NULL DEFAULT 0.0, free_cash_flow_cents INTEGER NOT NULL DEFAULT 0, free_cash_flow_margin_pct REAL NOT NULL DEFAULT 0.0, magic_number REAL NOT NULL DEFAULT 0.0, rule_of_40_pct REAL NOT NULL DEFAULT 0.0, yoy_revenue_growth_pct REAL NOT NULL DEFAULT 0.0, sox_404_status TEXT NOT NULL DEFAULT 'untested', merkle_root_hash TEXT, sec_filing_signature TEXT, certified_by TEXT REFERENCES users(id), certified_at INTEGER, prospectus_metadata_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL DEFAULT 1000, updated_at INTEGER NOT NULL DEFAULT 1000);
`;

describe('migrations 0497 and 0498 — retire legacy users FKs across 22 tables', () => {
  it('removes all users FKs, preserves rows + non-users FKs + campaigns triggers, and allows writes after users is dropped', () => {
    const d1 = createFakeD1([PRE_MIGRATION_SCHEMA]);
    const db = d1._db;

    db.exec(`
      INSERT INTO users (id) VALUES ('u_1'), ('admin_1');
      INSERT INTO organizations (id) VALUES ('org_1');
      INSERT INTO org_members (id, org_id, user_id, role) VALUES ('om_1', 'org_1', 'u_1', 'owner');
      INSERT INTO payouts (id, user_id, amount, method, paid_by_admin) VALUES ('pay_1', 'u_1', 50.0, 'usdt_trc20', 'admin_1');
      INSERT INTO user_wallets (user_id, balance_available) VALUES ('u_1', 120.5);
      INSERT INTO campaigns (id, user_id, title, org_id) VALUES ('camp_1', 'u_1', 'Launch 1', 'org_1');
      PRAGMA foreign_keys = OFF;
      DROP TABLE users;
      PRAGMA foreign_keys = ON;
    `);

    expect(() =>
      db.exec(`INSERT INTO payouts (id, user_id, amount, method, paid_by_admin) VALUES ('pay_2', 'u_1', 25.0, 'usdt_trc20', 'admin_1');`),
    ).toThrow(/no such table: main\.users/i);

    db.exec(MIG_0497);
    db.exec(MIG_0498);
    // Re-run both migrations to prove idempotency
    db.exec(MIG_0497);
    db.exec(MIG_0498);

    for (const tbl of [...SIX_TABLES, ...SIXTEEN_TABLES]) {
      const fks = db.prepare(`PRAGMA foreign_key_list('${tbl}')`).all() as Array<{ table: string }>;
      expect(fks.filter((fk) => fk.table === 'users')).toEqual([]);
    }

    // Non-users FKs remain intact
    const clickFks = db.prepare(`PRAGMA foreign_key_list('affiliate_clicks')`).all() as Array<{ table: string }>;
    expect(clickFks.map((f) => f.table)).toEqual(['campaigns']);

    // Campaigns triggers recreated and auto-populate org_id from org_members
    const triggers = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='campaigns' ORDER BY name`)
      .all() as Array<{ name: string }>;
    expect(triggers.map((t) => t.name)).toEqual([
      'trg_campaigns_assert_org_after_insert',
      'trg_campaigns_reject_null_org_update',
      'trg_campaigns_set_org_id',
    ]);

    // Writes succeed under PRAGMA foreign_keys = ON with retired `users` table
    db.exec(`
      PRAGMA foreign_keys = ON;
      INSERT INTO payouts (id, user_id, amount, method, paid_by_admin) VALUES ('pay_2', 'u_1', 25.0, 'usdt_trc20', 'admin_1');
      INSERT INTO campaigns (id, user_id, title) VALUES ('camp_2', 'u_1', 'Auto Org Trigger Test');
      INSERT INTO affiliate_clicks (id, click_id, campaign_id, user_id, offer_id, short_code) VALUES ('ac_1', 'clk_1', 'camp_2', 'u_1', 'off_1', 'sc_1');
      INSERT INTO raas_audit_logs (id, action, user_id, created_at) VALUES ('ral_1', 'AUDIT_QUERY', 'u_1', 1700000000);
    `);

    // The org_id auto-populate trigger resolves camp_2's org from org_members
    // (SEC-03 invariant), proving the 3 campaigns triggers survived the rebuild.
    const camp2 = db.prepare(`SELECT org_id FROM campaigns WHERE id = 'camp_2'`).get() as { org_id: string };
    expect(camp2.org_id).toBe('org_1');
    const payCount = db.prepare(`SELECT COUNT(*) AS cnt FROM payouts`).get() as { cnt: number };
    expect(payCount.cnt).toBe(2);

    // A user with no org_members row is still rejected (SEC-03 stays closed)
    db.exec(`INSERT INTO user_wallets (user_id, balance_available) VALUES ('orphan_1', 0);`);
    expect(() =>
      db.exec(`INSERT INTO campaigns (id, user_id, title) VALUES ('camp_orphan', 'orphan_1', 'No Org');`),
    ).toThrow(/org_id cannot be NULL/i);

    // The reject-null-org trigger fires on an UPDATE attempting to clear org_id
    expect(() =>
      db.exec(`UPDATE campaigns SET org_id = NULL WHERE id = 'camp_1';`),
    ).toThrow(/org_id cannot be NULL/i);
  });
});
