-- 0315_real_time_central_bank_clearing_and_iso20022_vault.sql
-- Gate 12: $25,000,000 MRR ($300M ARR, 100,000 Paid Customers)
-- Pillar 1: Real-Time Central Bank Clearing & ISO 20022 High-Value Engine (CBPR+)

-- 1. Central Bank & Real-Time Gross Settlement (RTGS) Clearing Nodes
CREATE TABLE IF NOT EXISTS central_bank_clearing_nodes (
  id TEXT PRIMARY KEY,
  bic_code TEXT NOT NULL UNIQUE, -- ISO 9362 BIC/SWIFT, e.g. FRNYUS33XXX (Fedwire), CHIPUS33XXX (CHIPS), TRGTDEFFXXX (TARGET2), MASGSG22XXX (FAST SG)
  institution_name TEXT NOT NULL,
  jurisdiction TEXT NOT NULL CHECK(jurisdiction IN ('US', 'EU', 'SG', 'VN', 'JP', 'UK', 'CH')),
  rtgs_network TEXT NOT NULL CHECK(rtgs_network IN ('FEDWIRE', 'CHIPS', 'TARGET2', 'FAST_SG', 'CITAD_VN', 'BOJ_NET', 'CHAPS')),
  clearing_status TEXT NOT NULL CHECK(clearing_status IN ('ACTIVE', 'RESTRICTED', 'SUSPENDED', 'OFFLINE')) DEFAULT 'ACTIVE',
  settlement_currency TEXT NOT NULL DEFAULT 'USD',
  credit_line_cents INTEGER NOT NULL DEFAULT 5000000000, -- $50M intraday liquidity credit line
  current_balance_cents INTEGER NOT NULL DEFAULT 2500000000, -- $25M clearing account balance
  last_settlement_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_cb_clearing_nodes_jurisdiction ON central_bank_clearing_nodes(jurisdiction, clearing_status);

-- 2. ISO 20022 Message Vault (pacs.009, pacs.004, camt.054)
CREATE TABLE IF NOT EXISTS iso20022_pacs_messages (
  id TEXT PRIMARY KEY,
  message_definition_id TEXT NOT NULL CHECK(message_definition_id IN ('pacs.009.001.10', 'pacs.004.001.11', 'camt.054.001.10')),
  end_to_end_id TEXT NOT NULL UNIQUE, -- ISO 20022 EndToEndId
  uetr TEXT NOT NULL UNIQUE, -- Unique End-to-end Transaction Reference (UUIDv4)
  instructing_agent_bic TEXT NOT NULL REFERENCES central_bank_clearing_nodes(bic_code),
  instructed_agent_bic TEXT NOT NULL REFERENCES central_bank_clearing_nodes(bic_code),
  settlement_currency TEXT NOT NULL,
  interbank_settlement_amount_cents INTEGER NOT NULL,
  settlement_date TEXT NOT NULL,
  charge_bearer TEXT NOT NULL CHECK(charge_bearer IN ('DEBT', 'CRED', 'SHAR', 'SLEV')) DEFAULT 'SHAR',
  raw_xml_payload TEXT NOT NULL,
  signature_digest_hex TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK(verification_status IN ('PARSED_VALID', 'SCHEMA_ERROR', 'SIGNATURE_INVALID', 'SETTLED', 'RETURNED')) DEFAULT 'PARSED_VALID',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_iso20022_pacs_status ON iso20022_pacs_messages(verification_status, settlement_date);

-- 3. RTGS Multilateral Settlement Batches
CREATE TABLE IF NOT EXISTS rtgs_settlement_batches (
  id TEXT PRIMARY KEY,
  batch_reference TEXT NOT NULL UNIQUE,
  cycle_number INTEGER NOT NULL,
  total_gross_volume_cents INTEGER NOT NULL,
  total_net_volume_cents INTEGER NOT NULL,
  compression_ratio_percentage REAL NOT NULL, -- e.g. 78.5% netting efficiency
  settled_transactions_count INTEGER NOT NULL,
  batch_status TEXT NOT NULL CHECK(batch_status IN ('OPEN', 'NETTING_CALCULATED', 'EXECUTING', 'COMPLETED', 'FAILED')) DEFAULT 'OPEN',
  merkle_root_hex TEXT NOT NULL,
  executed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- 4. Foreign Exchange Liquidity Corridors
CREATE TABLE IF NOT EXISTS foreign_exchange_corridors (
  id TEXT PRIMARY KEY,
  base_currency TEXT NOT NULL, -- USD, EUR, SGD, VND
  quote_currency TEXT NOT NULL,
  exchange_rate_micros INTEGER NOT NULL, -- 1.000000 = 1_000_000
  intraday_volume_cents INTEGER NOT NULL DEFAULT 0,
  spread_bps INTEGER NOT NULL DEFAULT 2, -- 2 bps = 0.02%
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_fx_corridors_pair ON foreign_exchange_corridors(base_currency, quote_currency);
