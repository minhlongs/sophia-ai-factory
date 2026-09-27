-- 0314_institutional_amm_clearing_vault.sql
-- Gate 11: $10,000,000 MRR ($120M ARR, 40,000 Paid Customers)
-- Pillar 3: Concentrated Liquidity AMM Clearing Vault, Slippage Caps & Dynamic Multi-Currency Treasury Rebalancer

-- 1. Concentrated Liquidity AMM Pools
CREATE TABLE IF NOT EXISTS amm_liquidity_pools (
  id TEXT PRIMARY KEY,
  pair_symbol TEXT NOT NULL UNIQUE, -- e.g. USDT_USD, USDC_EUR, USDT_VND, EUR_USD, SGD_USD, JPY_USD
  token0_symbol TEXT NOT NULL,
  token1_symbol TEXT NOT NULL,
  token0_decimals INTEGER NOT NULL DEFAULT 6,
  token1_decimals INTEGER NOT NULL DEFAULT 6,
  reserve0_amount_units TEXT NOT NULL DEFAULT '0',
  reserve1_amount_units TEXT NOT NULL DEFAULT '0',
  current_sqrt_price_x96 TEXT NOT NULL,
  current_tick INTEGER NOT NULL DEFAULT 0,
  tick_spacing INTEGER NOT NULL DEFAULT 10,
  fee_tier_bps INTEGER NOT NULL DEFAULT 5, -- 5 bps = 0.05%
  max_slippage_cap_bps INTEGER NOT NULL DEFAULT 3, -- 3 bps = 0.03%
  total_value_locked_usd_cents INTEGER NOT NULL DEFAULT 0,
  volume_24h_usd_cents INTEGER NOT NULL DEFAULT 0,
  is_circuit_breaker_tripped INTEGER NOT NULL DEFAULT 0 CHECK(is_circuit_breaker_tripped IN (0, 1)),
  last_rebalanced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_amm_liquidity_pools_pair ON amm_liquidity_pools(pair_symbol);

-- 2. AMM Swap Transactions & Anti-Sandwich Verification
CREATE TABLE IF NOT EXISTS amm_swap_transactions (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES amm_liquidity_pools(id) ON DELETE CASCADE,
  trader_identifier TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount_in_units TEXT NOT NULL,
  amount_out_units TEXT NOT NULL,
  token_in_symbol TEXT NOT NULL,
  token_out_symbol TEXT NOT NULL,
  effective_price_ratio REAL NOT NULL,
  slippage_experienced_bps INTEGER NOT NULL,
  fee_collected_cents INTEGER NOT NULL,
  anti_sandwich_nonce INTEGER NOT NULL,
  mev_protection_proof TEXT NOT NULL,
  execution_status TEXT NOT NULL CHECK(execution_status IN ('PENDING', 'EXECUTED', 'SLIPPAGE_REJECTED', 'CIRCUIT_BREAKER_HALTED')) DEFAULT 'EXECUTED',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_amm_swaps_pool ON amm_swap_transactions(pool_id, execution_status);
CREATE INDEX IF NOT EXISTS idx_amm_swaps_trader ON amm_swap_transactions(trader_identifier);

-- 3. Dynamic Multi-Currency Treasury Rebalancing Events
CREATE TABLE IF NOT EXISTS treasury_rebalance_events (
  id TEXT PRIMARY KEY,
  trigger_reason TEXT NOT NULL CHECK(trigger_reason IN ('SCHEDULED_PERIODIC', 'DEVIATION_THRESHOLD', 'EMERGENCY_ARBITRAGE', 'MANUAL_DISPATCH')),
  source_pool_id TEXT NOT NULL REFERENCES amm_liquidity_pools(id),
  target_pool_id TEXT NOT NULL REFERENCES amm_liquidity_pools(id),
  currency_moved TEXT NOT NULL,
  amount_moved_units TEXT NOT NULL,
  deviation_bps INTEGER NOT NULL,
  pre_rebalance_ratio REAL NOT NULL,
  post_rebalance_ratio REAL NOT NULL,
  multisig_operator_quorum TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PROPOSED', 'APPROVED', 'SETTLED', 'FAILED')) DEFAULT 'SETTLED',
  executed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_treasury_rebalance_source ON treasury_rebalance_events(source_pool_id, status);
