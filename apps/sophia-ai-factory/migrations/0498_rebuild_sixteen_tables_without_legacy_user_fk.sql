-- Migration 0498: remove legacy `users` FKs from the remaining sixteen tables
-- tracked in GH-121:
--   1. tier_change_events
--   2. campaigns (plus recreate its 3 org_id invariant triggers)
--   3. raas_licenses
--   4. raas_audit_logs
--   5. affiliate_offers_selected
--   6. affiliate_conversions
--   7. user_payout_settings
--   8. repurpose_jobs
--   9. thumbnail_variants
--  10. whatsapp_templates
--  11. whatsapp_message_log
--  12. localized_payment_transactions
--  13. financial_close_periods
--  14. revenue_schedules
--  15. intercompany_transfers
--  16. ipo_filing_periods
--
-- Migration 0439 retires `users` after moving auth to Better Auth's singular
-- `user` table. Three of these tables (`tier_change_events`, `campaigns`,
-- `raas_licenses`) were originally targeted by `0480_auth_2027_clean_slate.sql`,
-- which `guard_drop_rename` skipped on 2026-10-28 because staging tables were
-- included in the pre-flight `sqlite_master` count. All 16 definitions,
-- defaults, CHECK constraints, UNIQUE constraints, non-`users` foreign keys,
-- indexes, and triggers match the verified live D1 `sqlite_master` state
-- captured on 2026-11-07.

PRAGMA foreign_keys = OFF;

-- 1. tier_change_events (from 0009; drops user_id FK to users)
DROP TABLE IF EXISTS tier_change_events_new;

CREATE TABLE tier_change_events_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  org_id TEXT,
  from_tier TEXT,
  to_tier TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('upgrade', 'downgrade', 'cancel', 'activate')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO tier_change_events_new (
  id, user_id, org_id, from_tier, to_tier, event_type, created_at
)
SELECT
  id, user_id, org_id, from_tier, to_tier, event_type, created_at
FROM tier_change_events;

DROP TABLE tier_change_events;
ALTER TABLE tier_change_events_new RENAME TO tier_change_events;

CREATE INDEX IF NOT EXISTS idx_tce_user_id ON tier_change_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tce_created_at ON tier_change_events(created_at);
CREATE INDEX IF NOT EXISTS idx_tce_event_type ON tier_change_events(event_type);

-- 2. campaigns (from 0005 + 0046 + 0107 + 0227; drops user_id FK to users, preserves org_id triggers and refund_badge columns)
DROP TABLE IF EXISTS campaigns_new;

CREATE TABLE campaigns_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  topic TEXT,
  audience TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','queued','processing_script','processing_video','completed','failed','video_timeout')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  template_id TEXT,
  script_content TEXT,
  audio_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  org_id TEXT,
  refund_badge_cents INTEGER NOT NULL DEFAULT 0,
  refund_badge_updated_at TEXT
);

INSERT INTO campaigns_new (
  id, user_id, title, topic, audience, status, progress, template_id,
  script_content, audio_url, video_url, thumbnail_url, error_message,
  created_at, updated_at, org_id
)
SELECT
  id, user_id, title, topic, audience, status, progress, template_id,
  script_content, audio_url, video_url, thumbnail_url, error_message,
  created_at, updated_at, org_id
FROM campaigns;

DROP TABLE campaigns;
ALTER TABLE campaigns_new RENAME TO campaigns;

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_created ON campaigns(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_user ON campaigns(org_id, user_id);

DROP TRIGGER IF EXISTS trg_campaigns_set_org_id;
DROP TRIGGER IF EXISTS trg_campaigns_reject_null_org_update;
DROP TRIGGER IF EXISTS trg_campaigns_assert_org_after_insert;

-- Note: SQLite executes multiple AFTER INSERT triggers in reverse creation
-- order (most-recently-created fires first). Create the post-insert assertion
-- trigger BEFORE trg_campaigns_set_org_id so auto-population runs first.
CREATE TRIGGER IF NOT EXISTS trg_campaigns_assert_org_after_insert
AFTER INSERT ON campaigns
FOR EACH ROW
WHEN (SELECT org_id FROM campaigns WHERE id = NEW.id) IS NULL
BEGIN
  SELECT RAISE(ABORT, 'campaigns.org_id cannot be NULL — supply org_id or ensure user has org_members row (SEC-03)');
END;

CREATE TRIGGER IF NOT EXISTS trg_campaigns_reject_null_org_update
BEFORE UPDATE OF org_id ON campaigns
FOR EACH ROW
WHEN NEW.org_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'campaigns.org_id cannot be NULL (SEC-03 invariant)');
END;

CREATE TRIGGER IF NOT EXISTS trg_campaigns_set_org_id
AFTER INSERT ON campaigns
FOR EACH ROW
WHEN NEW.org_id IS NULL AND NEW.user_id IS NOT NULL
BEGIN
  UPDATE campaigns
     SET org_id = (
       SELECT om.org_id
         FROM org_members om
        WHERE om.user_id = NEW.user_id
        ORDER BY CASE om.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                 om.created_at ASC
        LIMIT 1
     )
   WHERE id = NEW.id;
END;

-- 3. raas_licenses (from 0006 + 0045 + 0049; drops revoked_by, created_by, user_id FKs to users)
DROP TABLE IF EXISTS raas_licenses_new;

CREATE TABLE raas_licenses_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key_hash TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('BASIC','PREMIUM','ENTERPRISE','MASTER')),
  expires_at INTEGER,
  nonce TEXT NOT NULL UNIQUE,
  is_revoked INTEGER DEFAULT 0,
  revoked_at INTEGER,
  revoked_by TEXT,
  created_by TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  metadata TEXT DEFAULT '{}',
  updated_at INTEGER,
  polar_customer_id TEXT,
  stripe_customer_id TEXT
);

INSERT INTO raas_licenses_new (
  id, key_hash, tier, expires_at, nonce, is_revoked, revoked_at,
  revoked_by, created_by, user_id, created_at, metadata, updated_at,
  polar_customer_id, stripe_customer_id
)
SELECT
  id, key_hash, tier, expires_at, nonce, is_revoked, revoked_at,
  revoked_by, created_by, user_id, created_at, metadata, updated_at,
  polar_customer_id, stripe_customer_id
FROM raas_licenses;

DROP TABLE raas_licenses;
ALTER TABLE raas_licenses_new RENAME TO raas_licenses;

CREATE INDEX IF NOT EXISTS idx_raas_licenses_key_hash ON raas_licenses(key_hash);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_nonce ON raas_licenses(nonce);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_tier ON raas_licenses(tier);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_user_id ON raas_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_created_by ON raas_licenses(created_by);
CREATE INDEX IF NOT EXISTS idx_raas_licenses_active ON raas_licenses(is_revoked, expires_at) WHERE is_revoked = 0;
CREATE INDEX IF NOT EXISTS idx_raas_licenses_user_created ON raas_licenses(user_id, created_at DESC);

-- 4. raas_audit_logs (from 0006 + 0131 + 0210 + 0243; preserves license_id -> raas_licenses(id), drops user_id FK to users, and applies 0210 relaxed action CHECK)
DROP TABLE IF EXISTS raas_audit_logs_new;

CREATE TABLE raas_audit_logs_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  action TEXT NOT NULL,
  license_id TEXT REFERENCES raas_licenses(id),
  license_nonce TEXT,
  user_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL,
  model_name TEXT,
  token_count INTEGER,
  ip_address_hash TEXT,
  user_pseudonym TEXT,
  previous_log_hash TEXT,
  content_hash TEXT NOT NULL DEFAULT '',
  hash_chain_valid INTEGER DEFAULT 1
);

INSERT INTO raas_audit_logs_new (
  id, action, license_id, license_nonce, user_id, ip_address, user_agent,
  details, created_at, model_name, token_count, ip_address_hash, user_pseudonym,
  previous_log_hash, content_hash, hash_chain_valid
)
SELECT
  id, action, license_id, license_nonce, user_id, ip_address, user_agent,
  details, created_at, model_name, token_count, ip_address_hash, user_pseudonym,
  previous_log_hash, content_hash, hash_chain_valid
FROM raas_audit_logs;

DROP TABLE raas_audit_logs;
ALTER TABLE raas_audit_logs_new RENAME TO raas_audit_logs;

CREATE INDEX IF NOT EXISTS idx_raas_audit_license ON raas_audit_logs(license_id);
CREATE INDEX IF NOT EXISTS idx_raas_audit_license_nonce ON raas_audit_logs(license_nonce);
CREATE INDEX IF NOT EXISTS idx_raas_audit_user ON raas_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_raas_audit_action ON raas_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_raas_audit_created ON raas_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_content_hash ON raas_audit_logs(content_hash);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_previous_hash ON raas_audit_logs(previous_log_hash);
CREATE INDEX IF NOT EXISTS idx_raas_audit_logs_chain_valid ON raas_audit_logs(hash_chain_valid);

-- 5. affiliate_offers_selected (from 0023; preserves campaign_id -> campaigns(id), drops user_id FK to users)
DROP TABLE IF EXISTS affiliate_offers_selected_new;

CREATE TABLE affiliate_offers_selected_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  offer_name TEXT NOT NULL,
  affiliate_link TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  network TEXT NOT NULL DEFAULT 'clickbank' CHECK (network IN ('clickbank','shareasale','amazon','manual')),
  commission_rate REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO affiliate_offers_selected_new (
  id, campaign_id, user_id, offer_id, offer_name, affiliate_link,
  short_code, network, commission_rate, created_at
)
SELECT
  id, campaign_id, user_id, offer_id, offer_name, affiliate_link,
  short_code, network, commission_rate, created_at
FROM affiliate_offers_selected;

DROP TABLE affiliate_offers_selected;
ALTER TABLE affiliate_offers_selected_new RENAME TO affiliate_offers_selected;

CREATE INDEX IF NOT EXISTS idx_affoff_campaign ON affiliate_offers_selected(campaign_id);
CREATE INDEX IF NOT EXISTS idx_affoff_user ON affiliate_offers_selected(user_id);
CREATE INDEX IF NOT EXISTS idx_affoff_short_code ON affiliate_offers_selected(short_code);

-- 6. affiliate_conversions (from 0023; preserves campaign_id -> campaigns(id), drops user_id FK to users)
DROP TABLE IF EXISTS affiliate_conversions_new;

CREATE TABLE affiliate_conversions_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  receipt TEXT NOT NULL,
  click_id TEXT,
  campaign_id TEXT REFERENCES campaigns(id),
  user_id TEXT,
  offer_id TEXT,
  network TEXT NOT NULL DEFAULT 'clickbank',
  event_type TEXT NOT NULL CHECK (event_type IN ('SALE','REFUND','CHARGEBACK','TEST')),
  gross_amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  commission_user REAL NOT NULL,
  commission_sophia REAL NOT NULL,
  payout_status TEXT NOT NULL DEFAULT 'pending_clearance'
    CHECK (payout_status IN ('pending_clearance','available','paid','reversed','unattributed')),
  available_at INTEGER,
  paid_at INTEGER,
  payout_id TEXT,
  raw_payload TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(receipt, event_type)
);

INSERT INTO affiliate_conversions_new (
  id, receipt, click_id, campaign_id, user_id, offer_id, network, event_type,
  gross_amount, currency, commission_user, commission_sophia, payout_status,
  available_at, paid_at, payout_id, raw_payload, created_at
)
SELECT
  id, receipt, click_id, campaign_id, user_id, offer_id, network, event_type,
  gross_amount, currency, commission_user, commission_sophia, payout_status,
  available_at, paid_at, payout_id, raw_payload, created_at
FROM affiliate_conversions;

DROP TABLE affiliate_conversions;
ALTER TABLE affiliate_conversions_new RENAME TO affiliate_conversions;

CREATE INDEX IF NOT EXISTS idx_conv_user ON affiliate_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_campaign ON affiliate_conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conv_click ON affiliate_conversions(click_id);
CREATE INDEX IF NOT EXISTS idx_conv_payout ON affiliate_conversions(payout_status, available_at);
CREATE INDEX IF NOT EXISTS idx_conv_user_payout ON affiliate_conversions(user_id, payout_status);
CREATE INDEX IF NOT EXISTS idx_conv_created ON affiliate_conversions(created_at DESC);

-- 7. user_payout_settings (from 0031 + 0048; drops user_id FK to users)
DROP TABLE IF EXISTS user_payout_settings_new;

CREATE TABLE user_payout_settings_new (
  user_id TEXT PRIMARY KEY,
  preferred_method TEXT CHECK (preferred_method IN ('usdt_trc20','usdt_erc20','bank_transfer')),
  payout_address TEXT,
  payout_address_verified INTEGER DEFAULT 0,
  stripe_account_id TEXT,
  stripe_account_status TEXT,
  stripe_payout_enabled INTEGER DEFAULT 0,
  stripe_onboarding_started_at TEXT,
  stripe_last_event_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO user_payout_settings_new (
  user_id, preferred_method, payout_address, payout_address_verified,
  stripe_account_id, stripe_account_status, stripe_payout_enabled,
  stripe_onboarding_started_at, stripe_last_event_at, updated_at
)
SELECT
  user_id, preferred_method, payout_address, payout_address_verified,
  stripe_account_id, stripe_account_status, stripe_payout_enabled,
  stripe_onboarding_started_at, stripe_last_event_at, updated_at
FROM user_payout_settings;

DROP TABLE user_payout_settings;
ALTER TABLE user_payout_settings_new RENAME TO user_payout_settings;

CREATE INDEX IF NOT EXISTS idx_payout_settings_stripe_acct
  ON user_payout_settings(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- 8. repurpose_jobs (from 0125; drops user_id FK to users)
DROP TABLE IF EXISTS repurpose_jobs_new;

CREATE TABLE repurpose_jobs_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  source_video_id TEXT NOT NULL,
  status TEXT DEFAULT 'analyzing',
  clip_manifest TEXT,
  total_clips INTEGER DEFAULT 0,
  completed_clips INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO repurpose_jobs_new (
  id, user_id, source_video_id, status, clip_manifest, total_clips, completed_clips, created_at
)
SELECT
  id, user_id, source_video_id, status, clip_manifest, total_clips, completed_clips, created_at
FROM repurpose_jobs;

DROP TABLE repurpose_jobs;
ALTER TABLE repurpose_jobs_new RENAME TO repurpose_jobs;

-- 9. thumbnail_variants (from 0125; drops user_id FK to users)
DROP TABLE IF EXISTS thumbnail_variants_new;

CREATE TABLE thumbnail_variants_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  video_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  variant_index INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  strategy TEXT NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  is_selected INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO thumbnail_variants_new (
  id, video_id, user_id, variant_index, r2_key, strategy, impressions, clicks, is_selected, created_at
)
SELECT
  id, video_id, user_id, variant_index, r2_key, strategy, impressions, clicks, is_selected, created_at
FROM thumbnail_variants;

DROP TABLE thumbnail_variants;
ALTER TABLE thumbnail_variants_new RENAME TO thumbnail_variants;

CREATE INDEX IF NOT EXISTS idx_thumbnail_variants_video_idx
  ON thumbnail_variants(video_id, variant_index);

-- 10. whatsapp_templates (from 0153 + 0162; drops user_id FK to users)
DROP TABLE IF EXISTS whatsapp_templates_new;

CREATE TABLE whatsapp_templates_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider_id INTEGER,
  phone_number_id TEXT NOT NULL,
  wa_token TEXT NOT NULL,
  waba_id TEXT,
  business_id TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  whatsapp_approved INTEGER NOT NULL DEFAULT 0
);

INSERT INTO whatsapp_templates_new (
  id, user_id, provider_id, phone_number_id, wa_token, waba_id, business_id,
  is_default, created_at, updated_at, whatsapp_approved
)
SELECT
  id, user_id, provider_id, phone_number_id, wa_token, waba_id, business_id,
  is_default, created_at, updated_at, whatsapp_approved
FROM whatsapp_templates;

DROP TABLE whatsapp_templates;
ALTER TABLE whatsapp_templates_new RENAME TO whatsapp_templates;

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user ON whatsapp_templates(user_id);

-- 11. whatsapp_message_log (from 0153; preserves template_id -> whatsapp_templates(id), drops user_id FK to users)
DROP TABLE IF EXISTS whatsapp_message_log_new;

CREATE TABLE whatsapp_message_log_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES whatsapp_templates(id),
  user_id INTEGER NOT NULL,
  provider_id INTEGER,
  recipient TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','instagram','facebook')),
  extern_message_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('send','react','template','media')),
  sub_type TEXT,
  text_preview TEXT,
  caption TEXT,
  payload TEXT,
  client_status TEXT NOT NULL DEFAULT ('received'),
  error_code TEXT,
  error_message TEXT,
  error_category TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  send_meta TEXT,
  sent_at INTEGER,
  delivered_at INTEGER,
  read_at INTEGER,
  failed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO whatsapp_message_log_new (
  id, template_id, user_id, provider_id, recipient, channel, extern_message_id,
  kind, sub_type, text_preview, caption, payload, client_status, error_code,
  error_message, error_category, retry_count, send_meta, sent_at, delivered_at,
  read_at, failed_at, created_at
)
SELECT
  id, template_id, user_id, provider_id, recipient, channel, extern_message_id,
  kind, sub_type, text_preview, caption, payload, client_status, error_code,
  error_message, error_category, retry_count, send_meta, sent_at, delivered_at,
  read_at, failed_at, created_at
FROM whatsapp_message_log;

DROP TABLE whatsapp_message_log;
ALTER TABLE whatsapp_message_log_new RENAME TO whatsapp_message_log;

CREATE INDEX IF NOT EXISTS idx_wa_msg_log_user ON whatsapp_message_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_log_template ON whatsapp_message_log(template_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_log_channel ON whatsapp_message_log(channel);

-- 12. localized_payment_transactions (from 0354; preserves org_id -> organizations(id) + fx_rate_id -> fx_exchange_rates(id), drops user_id FK to users)
DROP TABLE IF EXISTS localized_payment_transactions_new;

CREATE TABLE localized_payment_transactions_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual', 'one_time')),
  payment_rail TEXT NOT NULL CHECK (payment_rail IN (
    'SEPA_DIRECT_DEBIT', 'PROMPTPAY', 'PAYNOW', 'GRABPAY', 'PAYOS_VIETQR', 'NOWPAYMENTS_CRYPTO'
  )),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  base_amount_cents INTEGER NOT NULL,
  settlement_currency TEXT NOT NULL CHECK (settlement_currency IN (
    'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD', 'VND', 'THB', 'IDR', 'USDT', 'USDC'
  )),
  settlement_amount REAL NOT NULL,
  fx_rate_applied REAL NOT NULL,
  fx_rate_id TEXT REFERENCES fx_exchange_rates(id),
  tax_jurisdiction TEXT NOT NULL DEFAULT 'NONE' CHECK (tax_jurisdiction IN (
    'EU_MOSS', 'SG_GST', 'VN_TT78', 'US_SALES', 'EXEMPT', 'NONE'
  )),
  tax_rate REAL NOT NULL DEFAULT 0.0,
  tax_amount_cents INTEGER NOT NULL DEFAULT 0,
  tax_identifier TEXT,
  subtotal_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  rail_transaction_reference TEXT,
  qr_payload TEXT,
  mandate_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'authorized', 'completed', 'failed', 'refunded', 'charged_back', 'expired'
  )),
  idempotency_key TEXT NOT NULL UNIQUE,
  error_code TEXT,
  error_message TEXT,
  settled_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO localized_payment_transactions_new (
  id, org_id, user_id, tier, billing_cycle, payment_rail, base_currency,
  base_amount_cents, settlement_currency, settlement_amount, fx_rate_applied,
  fx_rate_id, tax_jurisdiction, tax_rate, tax_amount_cents, tax_identifier,
  subtotal_amount, total_amount, rail_transaction_reference, qr_payload,
  mandate_reference, status, idempotency_key, error_code, error_message,
  settled_at, expires_at, created_at, updated_at
)
SELECT
  id, org_id, user_id, tier, billing_cycle, payment_rail, base_currency,
  base_amount_cents, settlement_currency, settlement_amount, fx_rate_applied,
  fx_rate_id, tax_jurisdiction, tax_rate, tax_amount_cents, tax_identifier,
  subtotal_amount, total_amount, rail_transaction_reference, qr_payload,
  mandate_reference, status, idempotency_key, error_code, error_message,
  settled_at, expires_at, created_at, updated_at
FROM localized_payment_transactions;

DROP TABLE localized_payment_transactions;
ALTER TABLE localized_payment_transactions_new RENAME TO localized_payment_transactions;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lpt_idempotency ON localized_payment_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_lpt_org ON localized_payment_transactions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_lpt_rail_ref ON localized_payment_transactions(payment_rail, rail_transaction_reference);
CREATE INDEX IF NOT EXISTS idx_lpt_status ON localized_payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_lpt_created ON localized_payment_transactions(created_at);

-- 13. financial_close_periods (from 0355; preserves org_id -> organizations(id), drops closed_by FK to users)
DROP TABLE IF EXISTS financial_close_periods_new;

CREATE TABLE financial_close_periods_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  period_type TEXT NOT NULL CHECK(period_type IN ('monthly', 'quarterly', 'annual')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  close_status TEXT NOT NULL DEFAULT 'open' CHECK(close_status IN ('open', 'closing', 'closed', 'locked', 'audited', 'reopened')),
  closed_by TEXT,
  closed_at INTEGER,
  total_recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
  total_deferred_revenue_cents INTEGER NOT NULL DEFAULT 0,
  total_refunds_cents INTEGER NOT NULL DEFAULT 0,
  net_revenue_cents INTEGER NOT NULL DEFAULT 0,
  active_contracts_count INTEGER NOT NULL DEFAULT 0,
  merkle_root_hash TEXT,
  digital_signature TEXT,
  compliance_frameworks TEXT NOT NULL DEFAULT 'ASC_606,IFRS_15,VAS_TT200,SOX_404',
  audit_opinion TEXT NOT NULL DEFAULT 'unqualified' CHECK(audit_opinion IN ('unqualified', 'qualified', 'adverse', 'disclaimer', 'pending')),
  lock_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(org_id, period_key)
);

INSERT INTO financial_close_periods_new (
  id, org_id, period_key, period_type, start_date, end_date, close_status,
  closed_by, closed_at, total_recognized_revenue_cents, total_deferred_revenue_cents,
  total_refunds_cents, net_revenue_cents, active_contracts_count, merkle_root_hash,
  digital_signature, compliance_frameworks, audit_opinion, lock_reason,
  created_at, updated_at
)
SELECT
  id, org_id, period_key, period_type, start_date, end_date, close_status,
  closed_by, closed_at, total_recognized_revenue_cents, total_deferred_revenue_cents,
  total_refunds_cents, net_revenue_cents, active_contracts_count, merkle_root_hash,
  digital_signature, compliance_frameworks, audit_opinion, lock_reason,
  created_at, updated_at
FROM financial_close_periods;

DROP TABLE financial_close_periods;
ALTER TABLE financial_close_periods_new RENAME TO financial_close_periods;

CREATE INDEX IF NOT EXISTS idx_fcp_period_key ON financial_close_periods(period_key);
CREATE INDEX IF NOT EXISTS idx_fcp_status ON financial_close_periods(close_status);
CREATE INDEX IF NOT EXISTS idx_fcp_dates ON financial_close_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_fcp_org ON financial_close_periods(org_id, close_status);

-- 14. revenue_schedules (from 0355; preserves org_id -> organizations(id), drops user_id FK to users)
DROP TABLE IF EXISTS revenue_schedules_new;

CREATE TABLE revenue_schedules_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT,
  contract_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK(tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER', 'CUSTOM')),
  billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('monthly', 'annual', 'lifetime', 'custom')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD', 'VND', 'THB', 'IDR', 'USDT', 'USDC')),
  total_contract_value_cents INTEGER NOT NULL,
  recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
  deferred_revenue_cents INTEGER NOT NULL,
  daily_recognition_rate_cents REAL NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  term_days INTEGER NOT NULL,
  days_recognized INTEGER NOT NULL DEFAULT 0,
  accounting_standard TEXT NOT NULL DEFAULT 'ASC_606_IFRS_15' CHECK(accounting_standard IN ('ASC_606_IFRS_15', 'VAS_TT200', 'HYBRID_DUAL_LEDGER')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused', 'cancelled', 'refunded')),
  last_accrual_date TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

INSERT INTO revenue_schedules_new (
  id, org_id, user_id, contract_id, tier, billing_cycle, currency,
  total_contract_value_cents, recognized_revenue_cents, deferred_revenue_cents,
  daily_recognition_rate_cents, start_date, end_date, term_days, days_recognized,
  accounting_standard, status, last_accrual_date, metadata_json, created_at, updated_at
)
SELECT
  id, org_id, user_id, contract_id, tier, billing_cycle, currency,
  total_contract_value_cents, recognized_revenue_cents, deferred_revenue_cents,
  daily_recognition_rate_cents, start_date, end_date, term_days, days_recognized,
  accounting_standard, status, last_accrual_date, metadata_json, created_at, updated_at
FROM revenue_schedules;

DROP TABLE revenue_schedules;
ALTER TABLE revenue_schedules_new RENAME TO revenue_schedules;

CREATE INDEX IF NOT EXISTS idx_rs_org_status ON revenue_schedules(org_id, status);
CREATE INDEX IF NOT EXISTS idx_rs_contract ON revenue_schedules(contract_id);
CREATE INDEX IF NOT EXISTS idx_rs_tier ON revenue_schedules(tier);
CREATE INDEX IF NOT EXISTS idx_rs_dates ON revenue_schedules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rs_last_accrual ON revenue_schedules(last_accrual_date);

-- 15. intercompany_transfers (from 0355; drops approved_by FK to users)
DROP TABLE IF EXISTS intercompany_transfers_new;

CREATE TABLE intercompany_transfers_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  transfer_reference TEXT NOT NULL UNIQUE,
  origin_entity TEXT NOT NULL CHECK(origin_entity IN ('SOPHIA_GLOBAL_INC', 'SOPHIA_VN_CO_LTD', 'SOPHIA_SG_PTE_LTD', 'SOPHIA_EU_BV', 'SOPHIA_PARTNER_FEDERATION')),
  destination_entity TEXT NOT NULL CHECK(destination_entity IN ('SOPHIA_GLOBAL_INC', 'SOPHIA_VN_CO_LTD', 'SOPHIA_SG_PTE_LTD', 'SOPHIA_EU_BV', 'SOPHIA_PARTNER_FEDERATION')),
  transfer_type TEXT NOT NULL CHECK(transfer_type IN ('ip_license_royalty', 'service_fee', 'cost_sharing_recharge', 'mcu_compute_rebill', 'dividend_distribution')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD', 'EUR', 'GBP', 'JPY', 'SGD', 'VND', 'USDT')),
  gross_amount_cents INTEGER NOT NULL,
  withholding_tax_regime TEXT NOT NULL CHECK(withholding_tax_regime IN ('VN_FCT_10PCT', 'VN_FCT_5PCT', 'US_W8_30PCT', 'US_W8_TREATY_0PCT', 'SG_DTA_EXEMPT', 'NONE')),
  withholding_tax_rate_pct REAL NOT NULL DEFAULT 0.0,
  withholding_tax_amount_cents INTEGER NOT NULL DEFAULT 0,
  net_settlement_cents INTEGER NOT NULL,
  settlement_status TEXT NOT NULL DEFAULT 'pending' CHECK(settlement_status IN ('pending', 'approved', 'reconciled', 'settled', 'disputed', 'cancelled')),
  reconciliation_ledger_id TEXT,
  approved_by TEXT,
  transfer_date TEXT NOT NULL,
  settled_at INTEGER,
  supporting_docs_hash TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

INSERT INTO intercompany_transfers_new (
  id, transfer_reference, origin_entity, destination_entity, transfer_type,
  currency, gross_amount_cents, withholding_tax_regime, withholding_tax_rate_pct,
  withholding_tax_amount_cents, net_settlement_cents, settlement_status,
  reconciliation_ledger_id, approved_by, transfer_date, settled_at,
  supporting_docs_hash, notes, created_at, updated_at
)
SELECT
  id, transfer_reference, origin_entity, destination_entity, transfer_type,
  currency, gross_amount_cents, withholding_tax_regime, withholding_tax_rate_pct,
  withholding_tax_amount_cents, net_settlement_cents, settlement_status,
  reconciliation_ledger_id, approved_by, transfer_date, settled_at,
  supporting_docs_hash, notes, created_at, updated_at
FROM intercompany_transfers;

DROP TABLE intercompany_transfers;
ALTER TABLE intercompany_transfers_new RENAME TO intercompany_transfers;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ict_ref ON intercompany_transfers(transfer_reference);
CREATE INDEX IF NOT EXISTS idx_ict_entities ON intercompany_transfers(origin_entity, destination_entity, settlement_status);
CREATE INDEX IF NOT EXISTS idx_ict_transfer_date ON intercompany_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_ict_tax_regime ON intercompany_transfers(withholding_tax_regime);

-- 16. ipo_filing_periods (from 0355; drops certified_by FK to users)
DROP TABLE IF EXISTS ipo_filing_periods_new;

CREATE TABLE ipo_filing_periods_new (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  period_key TEXT NOT NULL UNIQUE,
  filing_type TEXT NOT NULL CHECK(filing_type IN ('S-1', 'F-1', '10-K', '10-Q', 'DUAL_LISTING')),
  target_exchanges TEXT NOT NULL DEFAULT 'NASDAQ,SGX',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'review_pending', 'sox_certified', 'board_approved', 'sec_submitted', 'effective', 'archived')),
  filing_date TEXT,
  effective_date TEXT,
  total_customers INTEGER NOT NULL DEFAULT 0 CHECK(total_customers >= 0),
  mrr_cents INTEGER NOT NULL DEFAULT 0 CHECK(mrr_cents >= 0),
  arr_cents INTEGER NOT NULL DEFAULT 0 CHECK(arr_cents >= 0),
  arpu_cents INTEGER NOT NULL DEFAULT 0 CHECK(arpu_cents >= 0),
  nrr_pct REAL NOT NULL DEFAULT 0.0 CHECK(nrr_pct >= 0.0),
  gross_margin_pct REAL NOT NULL DEFAULT 0.0 CHECK(gross_margin_pct >= 0.0 AND gross_margin_pct <= 100.0),
  gaap_revenue_cents INTEGER NOT NULL DEFAULT 0,
  gaap_cost_of_revenue_cents INTEGER NOT NULL DEFAULT 0,
  gaap_gross_profit_cents INTEGER NOT NULL DEFAULT 0,
  gaap_operating_expenses_cents INTEGER NOT NULL DEFAULT 0,
  gaap_operating_income_cents INTEGER NOT NULL DEFAULT 0,
  gaap_net_income_cents INTEGER NOT NULL DEFAULT 0,
  gaap_operating_cash_flow_cents INTEGER NOT NULL DEFAULT 0,
  capex_cents INTEGER NOT NULL DEFAULT 0,
  stock_based_compensation_cents INTEGER NOT NULL DEFAULT 0,
  depreciation_amortization_cents INTEGER NOT NULL DEFAULT 0,
  unrealized_fx_gain_loss_cents INTEGER NOT NULL DEFAULT 0,
  one_time_mna_restructuring_cents INTEGER NOT NULL DEFAULT 0,
  adjusted_ebitda_cents INTEGER NOT NULL DEFAULT 0,
  adjusted_ebitda_margin_pct REAL NOT NULL DEFAULT 0.0,
  free_cash_flow_cents INTEGER NOT NULL DEFAULT 0,
  free_cash_flow_margin_pct REAL NOT NULL DEFAULT 0.0,
  magic_number REAL NOT NULL DEFAULT 0.0 CHECK(magic_number >= 0.0),
  rule_of_40_pct REAL NOT NULL DEFAULT 0.0,
  yoy_revenue_growth_pct REAL NOT NULL DEFAULT 0.0,
  sox_404_status TEXT NOT NULL DEFAULT 'untested' CHECK(sox_404_status IN ('untested', 'in_progress', 'certified_clean', 'qualified_deficiency', 'adverse_weakness')),
  merkle_root_hash TEXT,
  sec_filing_signature TEXT,
  certified_by TEXT,
  certified_at INTEGER,
  prospectus_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

INSERT INTO ipo_filing_periods_new (
  id, period_key, filing_type, target_exchanges, status, filing_date, effective_date,
  total_customers, mrr_cents, arr_cents, arpu_cents, nrr_pct, gross_margin_pct,
  gaap_revenue_cents, gaap_cost_of_revenue_cents, gaap_gross_profit_cents,
  gaap_operating_expenses_cents, gaap_operating_income_cents, gaap_net_income_cents,
  gaap_operating_cash_flow_cents, capex_cents, stock_based_compensation_cents,
  depreciation_amortization_cents, unrealized_fx_gain_loss_cents,
  one_time_mna_restructuring_cents, adjusted_ebitda_cents, adjusted_ebitda_margin_pct,
  free_cash_flow_cents, free_cash_flow_margin_pct, magic_number, rule_of_40_pct,
  yoy_revenue_growth_pct, sox_404_status, merkle_root_hash, sec_filing_signature,
  certified_by, certified_at, prospectus_metadata_json, created_at, updated_at
)
SELECT
  id, period_key, filing_type, target_exchanges, status, filing_date, effective_date,
  total_customers, mrr_cents, arr_cents, arpu_cents, nrr_pct, gross_margin_pct,
  gaap_revenue_cents, gaap_cost_of_revenue_cents, gaap_gross_profit_cents,
  gaap_operating_expenses_cents, gaap_operating_income_cents, gaap_net_income_cents,
  gaap_operating_cash_flow_cents, capex_cents, stock_based_compensation_cents,
  depreciation_amortization_cents, unrealized_fx_gain_loss_cents,
  one_time_mna_restructuring_cents, adjusted_ebitda_cents, adjusted_ebitda_margin_pct,
  free_cash_flow_cents, free_cash_flow_margin_pct, magic_number, rule_of_40_pct,
  yoy_revenue_growth_pct, sox_404_status, merkle_root_hash, sec_filing_signature,
  certified_by, certified_at, prospectus_metadata_json, created_at, updated_at
FROM ipo_filing_periods;

DROP TABLE ipo_filing_periods;
ALTER TABLE ipo_filing_periods_new RENAME TO ipo_filing_periods;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ifp_period_key ON ipo_filing_periods(period_key);
CREATE INDEX IF NOT EXISTS idx_ifp_status ON ipo_filing_periods(status);
CREATE INDEX IF NOT EXISTS idx_ifp_type ON ipo_filing_periods(filing_type);
CREATE INDEX IF NOT EXISTS idx_ifp_sox_status ON ipo_filing_periods(sox_404_status);

PRAGMA foreign_keys = ON;
