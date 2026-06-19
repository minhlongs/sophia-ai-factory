/**
 * Types for affiliate network scout module.
 * @module lib/affiliates/scout/types
 */

/** Supported affiliate network identifiers */
export type Network =
  | 'impact_radius'
  | 'partnerstack'
  | 'cj'
  | 'mock'
  | 'shareasale'
  | 'awin_saas'
  | 'rakuten'
  | 'binance'
  | 'bybit'
  | 'bitget'
  | 'coinbase';

/** Normalised affiliate record */
export interface Affiliate {
  /** Stable UUID for local storage */
  id: string;
  tenantId: string;
  network: Network;
  /** Network's own identifier for this program */
  externalId: string;
  productName: string;
  productUrl?: string;
  commissionPct?: number;
  commissionFlatUsd?: number;
  category?: string;
  description?: string;
  discoveredAt: string;
  /** JSON-serialised raw response from network */
  rawPayload?: string;

  // --- Extended fields for scoring v2 ---
  /**
   * Earnings per click in USD.
   * EPC = (commission × conversion_rate) / clicks.
   * Absent → treated as neutral (0.5 score).
   */
  epc?: number;
  /**
   * 24h trading volume in USD for crypto exchange affiliates.
   * Absent → crypto volume factor skipped.
   */
  cryptoVolumeUsd?: number;
  /**
   * Whether the program requires KYC — indicates legitimacy for crypto affiliates.
   */
  kycRequired?: boolean;
  /**
   * Domain of the merchant (derived from productUrl or set explicitly).
   * Used by scam detector.
   */
  domain?: string;
}

/** Result returned by a single network client call */
export interface ScoutResult {
  network: Network;
  affiliates: Affiliate[];
  error?: string;
}

/** Minimal env required by network clients */
export interface ScoutEnv {
  DB?: D1Database;
  IMPACT_RADIUS_API_KEY?: string;
  PARTNERSTACK_API_KEY?: string;
  CJ_AFFILIATE_API_KEY?: string;
  /** ShareASale API token */
  SHAREASALE_TOKEN?: string;
  /** ShareASale publisher numeric ID */
  SHAREASALE_AFFILIATE_ID?: string;
  /** Awin Bearer API token */
  AWIN_API_TOKEN?: string;
  /** Awin publisher ID */
  AWIN_PUBLISHER_ID?: string;
  /** Rakuten Advertising Bearer token */
  RAKUTEN_TOKEN?: string;
  // --- Crypto exchange keys (env-level; BYOK takes precedence at runtime) ---
  BINANCE_API_KEY?: string;
  BINANCE_API_SECRET?: string;
  BYBIT_API_KEY?: string;
  BYBIT_API_SECRET?: string;
  BITGET_API_KEY?: string;
  BITGET_API_SECRET?: string;
  BITGET_PASSPHRASE?: string;
  COINBASE_API_KEY?: string;
  COINBASE_API_SECRET?: string;
}

/** Interface every network client must implement */
export interface NetworkClient {
  readonly network: Network;
  /**
   * Fetch affiliates from the network.
   * Implementations should return [] and log warnings rather than throw.
   * credentialsOverride: per-tenant BYOK takes precedence over env-level keys.
   */
  fetch(
    env: ScoutEnv,
    tenantId: string,
    credentialsOverride?: Record<string, string>,
  ): Promise<Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>[]>;
}
