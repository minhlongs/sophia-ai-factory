/**
 * All supported affiliate/exchange networks.
 * Must stay within the CHECK allow-list on affiliate_network_credentials
 * (migration 0488; the ad-network values live in land/adsense/types).
 * Postback verification only trusts credentials stored under these exact values.
 */
export type AffiliateNetwork =
  | 'impact_radius'
  | 'partnerstack'
  | 'cj'
  | 'shareasale'
  | 'clickbank'
  | 'binance'
  | 'bybit'
  | 'bitget'
  | 'coinbase'
  | 'rewardful'
  | 'awin'
  | 'tiktok_shop'
  | 'okx'
  | 'amazon'
  | 'accesstrade';

/** Credential payload shape per network */
export interface NetworkCredentialPayload {
  impact_radius: { client_id: string; client_secret: string };
  partnerstack: { api_key: string };
  cj: { api_key: string; website_id?: string };
  shareasale: { api_token: string; affiliate_id: string };
  clickbank: { api_key: string; clerk_key: string };
  binance: { api_key: string; api_secret: string };
  bybit: { api_key: string; api_secret: string };
  bitget: { api_key: string; api_secret: string; passphrase: string };
  coinbase: { api_key: string; api_secret: string };
  rewardful: { api_key: string; api_secret?: string };
  awin: { api_key: string; api_secret?: string };
  tiktok_shop: { api_key?: string; api_secret: string };
  okx: { api_key: string; api_secret: string; passphrase?: string };
  amazon: { api_key?: string; api_secret: string };
  accesstrade: { api_key?: string; api_secret: string };
}

export interface CredentialRow {
  network: AffiliateNetwork;
  status: 'active' | 'invalid' | 'rate_limited';
  last_validated_at: string | null;
}

/** D1 row shape */
export interface D1CredentialRow {
  id: string;
  tenant_id: string;
  network: AffiliateNetwork;
  encrypted_credentials: string;
  status: 'active' | 'invalid' | 'rate_limited';
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export function generateId(): string {
  return crypto.randomUUID();
}
