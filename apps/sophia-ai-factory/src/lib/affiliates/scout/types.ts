/**
 * Types for affiliate network scout module.
 * @module lib/affiliates/scout/types
 */

/** Supported affiliate network identifiers */
export type Network = 'impact_radius' | 'partnerstack' | 'cj' | 'mock';

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
}

/** Interface every network client must implement */
export interface NetworkClient {
  readonly network: Network;
  /**
   * Fetch affiliates from the network.
   * Implementations should return [] and log warnings rather than throw.
   */
  fetch(env: ScoutEnv, tenantId: string): Promise<Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>[]>;
}
