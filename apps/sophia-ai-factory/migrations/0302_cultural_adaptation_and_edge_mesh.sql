-- Migration 0302: Cultural Adaptation, Edge Mesh & Cross-Border Ledger
-- Supports Milestone $800k MRR: Dialect Normalizers, Regional Compliance, 12-Language Edge Mesh & Withholding Tax

-- ============================================================================
-- 1. regional_compliance_rules
-- Stores regional ad regulations, mandatory AI disclosure labels, and forbidden terms.
-- ============================================================================
CREATE TABLE IF NOT EXISTS regional_compliance_rules (
  id TEXT PRIMARY KEY,
  region_code TEXT NOT NULL, -- 'EU', 'US', 'JP', 'VN', 'SG', 'GLOBAL'
  category TEXT NOT NULL CHECK(category IN ('ai_disclosure', 'stealth_marketing', 'data_privacy', 'consumer_protection')),
  mandatory_label_en TEXT NOT NULL,
  mandatory_label_local TEXT NOT NULL,
  watermark_required INTEGER NOT NULL DEFAULT 1,
  audio_disclosure_required INTEGER NOT NULL DEFAULT 0,
  forbidden_terms_json TEXT NOT NULL DEFAULT '[]', -- Array of regex patterns / keywords
  disclosure_position TEXT NOT NULL DEFAULT 'bottom_right' CHECK(disclosure_position IN ('bottom_right', 'bottom_left', 'top_right', 'top_left', 'intro_frame', 'outro_frame')),
  effective_date INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_compliance_region ON regional_compliance_rules(region_code, category);

-- ============================================================================
-- 2. localized_voice_profiles
-- Stores regional dialect voice configurations, prosody templates, and lexical maps.
-- ============================================================================
CREATE TABLE IF NOT EXISTS localized_voice_profiles (
  id TEXT PRIMARY KEY,
  preset_id TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL, -- e.g. 'en-US', 'en-GB', 'ja-JP-tokyo', 'ja-JP-osaka', 'vi-VN-bac', 'vi-VN-nam'
  base_language TEXT NOT NULL, -- 'en', 'ja', 'vi', etc.
  dialect_code TEXT NOT NULL, -- 'us', 'uk', 'tokyo', 'osaka', 'bac', 'trung', 'nam'
  display_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('male', 'female', 'neutral')),
  edge_voice_name TEXT NOT NULL,
  pitch_adjustment REAL NOT NULL DEFAULT 0.0,
  rate_adjustment REAL NOT NULL DEFAULT 1.0,
  prosody_ssml_template TEXT,
  lexical_dictionary_json TEXT NOT NULL DEFAULT '{}',
  min_tier TEXT NOT NULL DEFAULT 'BASIC' CHECK(min_tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'beta', 'deprecated')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_voice_profiles_locale ON localized_voice_profiles(locale);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_dialect ON localized_voice_profiles(base_language, dialect_code);

-- ============================================================================
-- 3. localized_content_audit_log
-- Audit trail of AI disclosure injections and ad compliance scans.
-- ============================================================================
CREATE TABLE IF NOT EXISTS localized_content_audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  region_code TEXT NOT NULL,
  compliance_status TEXT NOT NULL CHECK(compliance_status IN ('passed', 'flagged', 'remediated', 'rejected')),
  violations_detected_json TEXT NOT NULL DEFAULT '[]',
  remediations_applied_json TEXT NOT NULL DEFAULT '[]',
  ai_label_injected INTEGER NOT NULL DEFAULT 1,
  audited_by TEXT NOT NULL DEFAULT 'system_compliance_engine',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON localized_content_audit_log(tenant_id, video_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_region ON localized_content_audit_log(region_code, compliance_status);

-- ============================================================================
-- 4. partner_cross_border_ledger
-- Tracks cross-border affiliate/reseller payouts, FX conversions, and statutory withholding taxes.
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_cross_border_ledger (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  payout_batch_id TEXT,
  gross_commission_cents INTEGER NOT NULL, -- USD cents
  wht_jurisdiction TEXT NOT NULL CHECK(wht_jurisdiction IN ('VN_FCT', 'US_W8', 'EU_RC', 'SG_NR', 'STANDARD_ZERO')),
  wht_rate_pct REAL NOT NULL DEFAULT 0.0,
  wht_amount_cents INTEGER NOT NULL DEFAULT 0,
  net_commission_cents INTEGER NOT NULL, -- gross - wht
  payout_currency TEXT NOT NULL CHECK(payout_currency IN ('USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD', 'VND', 'THB', 'IDR')),
  applied_fx_rate REAL NOT NULL DEFAULT 1.0,
  hedging_buffer_pct REAL NOT NULL DEFAULT 1.5,
  net_payout_local_amount INTEGER NOT NULL DEFAULT 0, -- Local currency integer (VND/JPY units or EUR/GBP cents)
  tax_id_number TEXT,
  tax_certificate_status TEXT NOT NULL DEFAULT 'pending' CHECK(tax_certificate_status IN ('verified', 'pending', 'exempt', 'rejected')),
  status TEXT NOT NULL DEFAULT 'accrued' CHECK(status IN ('accrued', 'withheld', 'remitted_to_tax_authority', 'settled', 'cancelled')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  settled_at INTEGER,
  FOREIGN KEY (partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cross_border_partner ON partner_cross_border_ledger(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_cross_border_order ON partner_cross_border_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_cross_border_jurisdiction ON partner_cross_border_ledger(wht_jurisdiction, tax_certificate_status);

-- ============================================================================
-- 5. Seed Canonical Regional Compliance Baseline Rules
-- ============================================================================
INSERT OR IGNORE INTO regional_compliance_rules (
  id, region_code, category, mandatory_label_en, mandatory_label_local, watermark_required, audio_disclosure_required, forbidden_terms_json, disclosure_position
) VALUES
(
  'rule-eu-ai-act-001',
  'EU',
  'ai_disclosure',
  'AI-Generated Content (Sophia AI)',
  'Contenu généré par IA (Sophia AI)',
  1,
  1,
  '["100% guaranteed return", "zero risk", "miracle cure", "instant riches"]',
  'bottom_right'
),
(
  'rule-us-ftc-001',
  'US',
  'ai_disclosure',
  'Synthetic Media: Created with Sophia AI',
  'Synthetic Media: Created with Sophia AI',
  1,
  0,
  '["FDA approved AI", "guaranteed profit", "cure all", "risk-free investment"]',
  'bottom_right'
),
(
  'rule-jp-keihyo-001',
  'JP',
  'stealth_marketing',
  'Advertisement / AI-Generated (Sophia AI)',
  'PR / AI生成動画 (Sophia AI)',
  1,
  1,
  '["世界一", "ナンバーワン", "絶対儲かる", "完全無料", "効果絶大", "誰でも確実に"]',
  'bottom_right'
),
(
  'rule-vn-decree13-001',
  'VN',
  'ai_disclosure',
  'Content created with Sophia AI',
  'Nội dung được tạo bằng trí tuệ nhân tạo (Sophia AI)',
  1,
  1,
  '["chữa khỏi 100%", "cam kết dứt điểm", "thuốc tiên", "hoàn tiền vô điều kiện", "lợi nhuận cam kết"]',
  'bottom_right'
);
