/**
 * @module seed/config/cex-affiliate-registry
 * Canonical Crypto CEX Affiliate registry for Binance, Bybit, OKX, and Bitget.
 * Includes fee structures, kickback tiers, and unauthenticated public market endpoints.
 */

export type CexExchangeId = 'binance' | 'bybit' | 'okx' | 'bitget';

export interface CexAffiliateProgramSpec {
  exchange: CexExchangeId;
  displayName: string;
  makerFeePct: number;
  takerFeePct: number;
  maxAffiliateRebatePct: number;
  defaultUserKickbackPct: number;
  maxWelcomeBonusUsd: number;
  kycRequired: boolean;
  referralBaseUrl: string;
  publicTickerEndpoint: string;
  publicFundingEndpoint: string;
}

export const CEX_AFFILIATE_REGISTRY: Record<CexExchangeId, CexAffiliateProgramSpec> = {
  binance: {
    exchange: 'binance',
    displayName: 'Binance',
    makerFeePct: 0.1,
    takerFeePct: 0.1,
    maxAffiliateRebatePct: 50,
    defaultUserKickbackPct: 20,
    maxWelcomeBonusUsd: 600,
    kycRequired: true,
    referralBaseUrl: 'https://accounts.binance.com/register?ref=',
    publicTickerEndpoint: 'https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT',
    publicFundingEndpoint: 'https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT',
  },
  bybit: {
    exchange: 'bybit',
    displayName: 'Bybit',
    makerFeePct: 0.1,
    takerFeePct: 0.1,
    maxAffiliateRebatePct: 50,
    defaultUserKickbackPct: 20,
    maxWelcomeBonusUsd: 30000,
    kycRequired: true,
    referralBaseUrl: 'https://partner.bybit.com/b/',
    publicTickerEndpoint: 'https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT',
    publicFundingEndpoint: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT',
  },
  okx: {
    exchange: 'okx',
    displayName: 'OKX',
    makerFeePct: 0.08,
    takerFeePct: 0.1,
    maxAffiliateRebatePct: 50,
    defaultUserKickbackPct: 20,
    maxWelcomeBonusUsd: 10000,
    kycRequired: true,
    referralBaseUrl: 'https://www.okx.com/join/',
    publicTickerEndpoint: 'https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT',
    publicFundingEndpoint: 'https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP',
  },
  bitget: {
    exchange: 'bitget',
    displayName: 'Bitget',
    makerFeePct: 0.1,
    takerFeePct: 0.1,
    maxAffiliateRebatePct: 50,
    defaultUserKickbackPct: 20,
    maxWelcomeBonusUsd: 6200,
    kycRequired: true,
    referralBaseUrl: 'https://partner.bitget.com/bg/',
    publicTickerEndpoint: 'https://api.bitget.com/api/v2/spot/market/tickers?symbol=BTCUSDT',
    publicFundingEndpoint: 'https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol=BTCUSDT&productType=usdt-futures',
  },
};
