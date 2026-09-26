-- Migration 0307: Autonomous Creator DAO Royalty Splits & C2PA Content Provenance Ledger
-- Milestone: Gate 9 ($2,500,000 MRR Scale & The Deca-Million Ecosystem)
-- Supports Pillar 2: Creator DAO 80/20 & 70/30 Waterfall, Multi-Currency Micro-Settlements & C2PA Tamper-Evident Signatures
-- Target: Cloudflare D1 (sophia-raas-db)

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. creator_licensing_contracts
-- Digital licensing agreements between Creator DAOs/Creators and Sophia AI Factory.
-- Defines Smart Split Waterfall ratios, commercial terms, and cryptographic signature.
-- ============================================================================
CREATE TABLE IF NOT EXISTS creator_licensing_contracts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  contract_number TEXT NOT NULL UNIQUE, -- e.g. 'CLC-2027-0001'
  creator_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  dao_id TEXT, -- Optional ID for Creator DAO or Guild federation
  contract_title TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK(contract_type IN ('standard_marketplace', 'dao_exclusive', 'co_production', 'syndication_franchise')),
  split_tier TEXT NOT NULL CHECK(split_tier IN ('DAO_80_20', 'STANDARD_70_30', 'CUSTOM')),
  creator_share_pct REAL NOT NULL DEFAULT 70.0 CHECK(creator_share_pct >= 0.0 AND creator_share_pct <= 100.0),
  platform_share_pct REAL NOT NULL DEFAULT 30.0 CHECK(platform_share_pct >= 0.0 AND platform_share_pct <= 100.0),
  dao_treasury_share_pct REAL NOT NULL DEFAULT 0.0 CHECK(dao_treasury_share_pct >= 0.0 AND dao_treasury_share_pct <= 100.0),
  commercial_rights TEXT NOT NULL DEFAULT 'non_exclusive' CHECK(commercial_rights IN ('exclusive', 'non_exclusive', 'sole')),
  ai_training_permission TEXT NOT NULL DEFAULT 'prohibited' CHECK(ai_training_permission IN ('prohibited', 'allowed_with_attribution', 'licensed')),
  minimum_payout_cents INTEGER NOT NULL DEFAULT 5000 CHECK(minimum_payout_cents >= 1000), -- $50.00 default, min $10.00
  preferred_payout_rail TEXT NOT NULL DEFAULT 'NOWPAYMENTS_USDC_ARBITRUM' CHECK(preferred_payout_rail IN (
    'NOWPAYMENTS_USDC_ARBITRUM',
    'NOWPAYMENTS_USDC_POLYGON',
    'PAYOS_VIETQR',
    'PROMPTPAY',
    'SEPA_INSTANT'
  )),
  contractor_tax_regime TEXT NOT NULL DEFAULT 'EXEMPT_NONE' CHECK(contractor_tax_regime IN (
    'VN_CONTRACTOR_10PCT',
    'VN_CONTRACTOR_5PCT',
    'US_W8BEN_30PCT',
    'US_W8BEN_TREATY_10PCT',
    'TH_WHT_3PCT',
    'EU_REVERSE_CHARGE_0PCT',
    'EXEMPT_NONE'
  )),
  tax_withholding_rate_pct REAL NOT NULL DEFAULT 0.0 CHECK(tax_withholding_rate_pct >= 0.0 AND tax_withholding_rate_pct <= 100.0),
  tax_id_number TEXT, -- Tax identification number / MST / TIN
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft', 'pending_approval', 'active', 'suspended', 'terminated', 'expired')),
  terms_canonical_json TEXT NOT NULL DEFAULT '{}',
  contract_hash TEXT NOT NULL, -- SHA-256 of terms_canonical_json
  creator_signature TEXT NOT NULL, -- Cryptographic signature over contract_hash
  starts_at INTEGER NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clc_contract_number ON creator_licensing_contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_clc_creator ON creator_licensing_contracts(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_clc_dao ON creator_licensing_contracts(dao_id, status);
CREATE INDEX IF NOT EXISTS idx_clc_split_tier ON creator_licensing_contracts(split_tier);
CREATE INDEX IF NOT EXISTS idx_clc_dates ON creator_licensing_contracts(starts_at, expires_at);

-- ============================================================================
-- 2. creator_royalty_settlements
-- Multi-currency micro-settlement ledger with contractor tax withholding.
-- Supports NOWPayments USDC (Arbitrum/Polygon), PayOS VietQR, PromptPay, and SEPA Instant.
-- ============================================================================
CREATE TABLE IF NOT EXISTS creator_royalty_settlements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  settlement_reference TEXT NOT NULL UNIQUE, -- e.g. 'SETTLE-20270926-XXXX'
  contract_id TEXT NOT NULL REFERENCES creator_licensing_contracts(id) ON DELETE CASCADE,
  creator_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES creator_templates(id) ON DELETE SET NULL,
  batch_id TEXT, -- Batch grouping for micro-settlement aggregation
  gross_royalty_cents INTEGER NOT NULL CHECK(gross_royalty_cents >= 0),
  platform_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(platform_fee_cents >= 0),
  dao_treasury_cents INTEGER NOT NULL DEFAULT 0 CHECK(dao_treasury_cents >= 0),
  contractor_tax_regime TEXT NOT NULL CHECK(contractor_tax_regime IN (
    'VN_CONTRACTOR_10PCT',
    'VN_CONTRACTOR_5PCT',
    'US_W8BEN_30PCT',
    'US_W8BEN_TREATY_10PCT',
    'TH_WHT_3PCT',
    'EU_REVERSE_CHARGE_0PCT',
    'EXEMPT_NONE'
  )),
  tax_withholding_rate_pct REAL NOT NULL DEFAULT 0.0 CHECK(tax_withholding_rate_pct >= 0.0 AND tax_withholding_rate_pct <= 100.0),
  tax_withheld_cents INTEGER NOT NULL DEFAULT 0 CHECK(tax_withheld_cents >= 0),
  rail_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(rail_fee_cents >= 0),
  net_payable_cents INTEGER NOT NULL CHECK(net_payable_cents >= 0),
  payout_rail TEXT NOT NULL CHECK(payout_rail IN (
    'NOWPAYMENTS_USDC_ARBITRUM',
    'NOWPAYMENTS_USDC_POLYGON',
    'PAYOS_VIETQR',
    'PROMPTPAY',
    'SEPA_INSTANT'
  )),
  settlement_currency TEXT NOT NULL CHECK(settlement_currency IN ('USDC', 'USDT', 'VND', 'THB', 'EUR', 'USD')),
  settlement_amount REAL NOT NULL CHECK(settlement_amount >= 0.0),
  fx_rate_applied REAL NOT NULL DEFAULT 1.0,
  destination_address TEXT NOT NULL, -- EVM address (Arbitrum/Polygon), IBAN, account number, or PromptPay ID
  destination_bank_bin TEXT, -- 6-digit NAPAS BIN for VietQR
  destination_name TEXT NOT NULL, -- Payee name
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'queued', 'processing', 'settled', 'failed', 'disputed', 'reverted')),
  tx_hash TEXT, -- Blockchain transaction hash or bank confirmation number
  qr_payload TEXT, -- Raw QR data string for instant scanning (VietQR / PromptPay)
  idempotency_key TEXT NOT NULL UNIQUE,
  failure_reason TEXT,
  settled_at INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crs_reference ON creator_royalty_settlements(settlement_reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crs_idempotency ON creator_royalty_settlements(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_crs_contract ON creator_royalty_settlements(contract_id, status);
CREATE INDEX IF NOT EXISTS idx_crs_creator ON creator_royalty_settlements(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_crs_batch ON creator_royalty_settlements(batch_id);
CREATE INDEX IF NOT EXISTS idx_crs_rail ON creator_royalty_settlements(payout_rail, status);
CREATE INDEX IF NOT EXISTS idx_crs_status_created ON creator_royalty_settlements(status, created_at ASC);

-- ============================================================================
-- 3. c2pa_provenance_manifests
-- Tamper-evident C2PA cryptographic provenance manifests against deepfakes.
-- Stores SHA-256 asset hash, canonical assertion claims, and Web Crypto digital signatures.
-- ============================================================================
CREATE TABLE IF NOT EXISTS c2pa_provenance_manifests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  manifest_id TEXT NOT NULL UNIQUE, -- URN format: 'urn:c2pa:sophia:manifest:2027:...'
  asset_id TEXT NOT NULL, -- Sophia video asset or job ID
  asset_sha256 TEXT NOT NULL CHECK(length(asset_sha256) = 64), -- SHA-256 lowercase hex of video stream
  claim_generator TEXT NOT NULL DEFAULT 'Sophia-AI-Factory/1.0.0 (C2PA-Edge/2027)',
  title TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'video/mp4',
  claim_canonical_json TEXT NOT NULL, -- Deterministic canonical JSON representation of assertions & metadata
  manifest_hash TEXT NOT NULL CHECK(length(manifest_hash) = 64), -- SHA-256 of claim_canonical_json
  signer_identity TEXT NOT NULL DEFAULT 'SOPHIA_C2PA_ROOT_AUTHORITY_2027',
  signature_algorithm TEXT NOT NULL DEFAULT 'HMAC-SHA256' CHECK(signature_algorithm IN ('HMAC-SHA256', 'Ed25519', 'ES256')),
  digital_signature TEXT NOT NULL, -- Cryptographic signature over manifest_hash
  assertions_json TEXT NOT NULL DEFAULT '[]', -- C2PA standard assertions array
  ingredients_json TEXT NOT NULL DEFAULT '[]', -- Upstream source assets & hashes
  tamper_status TEXT NOT NULL DEFAULT 'valid' CHECK(tamper_status IN ('valid', 'tampered', 'revoked', 'unknown')),
  verified_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_c2pa_manifest_id ON c2pa_provenance_manifests(manifest_id);
CREATE INDEX IF NOT EXISTS idx_c2pa_asset ON c2pa_provenance_manifests(asset_id);
CREATE INDEX IF NOT EXISTS idx_c2pa_asset_hash ON c2pa_provenance_manifests(asset_sha256);
CREATE INDEX IF NOT EXISTS idx_c2pa_tamper_status ON c2pa_provenance_manifests(tamper_status);
CREATE INDEX IF NOT EXISTS idx_c2pa_created ON c2pa_provenance_manifests(created_at DESC);
