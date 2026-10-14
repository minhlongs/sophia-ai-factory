export const CRON_NAME = 'affiliate-scout';
export const CRON_RUN_LOG_PREFIX = 'affiliate-scout-tenant';

/** Tier values in D1 that qualify as PREMIUM or above */
export const PREMIUM_PLANS = ['premium', 'enterprise', 'master'] as const;

export interface TenantRow {
  org_id: string;
}

export interface ScoutEnv {
  DB: D1Database;
  IMPACT_RADIUS_API_KEY?: string;
  PARTNERSTACK_API_KEY?: string;
  CJ_AFFILIATE_API_KEY?: string;
  SHAREASALE_TOKEN?: string;
  SHAREASALE_AFFILIATE_ID?: string;
  AWIN_API_TOKEN?: string;
  AWIN_PUBLISHER_ID?: string;
  RAKUTEN_TOKEN?: string;
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
