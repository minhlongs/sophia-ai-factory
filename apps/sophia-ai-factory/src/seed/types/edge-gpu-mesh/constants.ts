/**
 * @file constants.ts
 * @description Constants for Gate 10 Edge GPU Mesh, SLAs, and balancing.
 * @layer seed
 */

import type { SixNinesBreachTier, VideoResolution } from './enums';

export const GATE_10_CONSTANTS = {
  TARGET_MRR_CENTS: 500_000_000, // $5,000,000.00 USD
  TARGET_ARR_CENTS: 6_000_000_000, // $60,000,000.00 USD
  TARGET_CUSTOMERS: 20_000,
  TARGET_ARPU_CENTS: 25_000, // $250.00 USD
  TARGET_NRR_PCT: 140.0, // >= 140.0%
  TARGET_GRR_PCT: 95.0, // >= 95.0%
  SIX_NINES_SLA_PCT: 99.9999, // 99.9999% Ultra-SLA
  MONTHLY_PERIOD_SECONDS: 2_592_000, // 30 days * 86,400s
  SIX_NINES_ALLOWED_DOWNTIME_SECONDS: 2.592, // Exactly 2,592,000 * 0.000001 = 2.592s
  FOUR_K_MAX_RENDER_MS: 15_000, // 15,000ms = 15 seconds target
  FAILOVER_MAX_REROUTE_MS: 20, // Sub-20ms failover rerouting target
  DEFAULT_ESCROW_DEPOSIT_PCT: 20.0, // 20% of monthly contract value deposited into escrow
} as const;

export const FITNESS_WEIGHTS = {
  LOAD: 0.35,
  LATENCY: 0.25,
  SPOT_PRICE: 0.20,
  HEALTH: 0.20,
} as const;

export const RESOLUTION_VRAM_MIN_GB: Record<VideoResolution, number> = {
  '720p': 16,
  '1080p': 24,
  '4K': 48,
  '8K': 80,
} as const;

export const BREACH_PENALTY_PCT: Record<SixNinesBreachTier, number> = {
  none: 0.0,
  minor: 15.0,
  moderate: 35.0,
  major: 70.0,
  catastrophic: 100.0,
} as const;
