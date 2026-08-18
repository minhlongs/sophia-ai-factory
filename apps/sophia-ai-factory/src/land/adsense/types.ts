/**
 * Ad network type definitions for BYOK credential storage.
 * @module land/adsense/types
 */

/** Supported ad network integrations */
export type AdNetworkType =
  | 'google_adsense'
  | 'youtube_partner'
  | 'adsense_legacy';

/** Credentials payload for a single ad network */
export interface AdNetworkCredentials {
  network: AdNetworkType;
  apiKey: string;
  partnerId: string;
  additionalConfig?: Record<string, string>;
}

/** Ad revenue configuration for a workspace */
export interface AdRevenueConfig {
  workspaceId: string;
  networks: AdNetworkType[];
  refreshIntervalMinutes: number;
}

/** Supported network identifiers for DB storage */
export const SUPPORTED_AD_NETWORKS: ReadonlySet<string> = new Set<string>([
  'google_adsense',
  'youtube_partner',
  'adsense_legacy',
]);
