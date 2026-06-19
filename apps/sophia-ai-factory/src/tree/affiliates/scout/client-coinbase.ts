/**
 * Coinbase Advanced Trade affiliate client.
 * Endpoint: GET /api/v3/brokerage/accounts -- verify credentials
 * Auth: HMAC-SHA256 signed headers (CB-ACCESS-*).
 * Returns mock fixture when credentials missing (fail-open).
 * @module lib/affiliates/scout/client-coinbase
 */

import type { NetworkClient, ScoutEnv } from './types';
import type { Affiliate } from './types';
import { buildCoinbaseSignedHeaders } from '@/seed/utils/crypto-exchange-hmac-signing';
import { logger } from '@/seed/utils/logger-utility';

const COINBASE_BASE = 'https://api.coinbase.com';
const TIMEOUT_MS = 8_000;

type AffiliateRow = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;

const MOCK_FIXTURE: AffiliateRow[] = [
  {
    network: 'coinbase',
    externalId: 'coinbase-affiliate-mock',
    productName: 'Coinbase Affiliate Program',
    productUrl: 'https://www.coinbase.com/affiliate-program',
    commissionPct: 50,
    category: 'crypto_exchange',
    description: 'Earn up to 50% of trading fees from referred users.',
    domain: 'coinbase.com',
    kycRequired: true,
    epc: 5.0,
  },
];

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const coinbaseClient: NetworkClient = {
  network: 'coinbase',

  async fetch(
    env: ScoutEnv,
    tenantId: string,
    credentialsOverride?: Record<string, string>,
  ): Promise<AffiliateRow[]> {
    const apiKey = credentialsOverride?.api_key ?? env.COINBASE_API_KEY;
    const apiSecret = credentialsOverride?.api_secret ?? env.COINBASE_API_SECRET;

    if (!apiKey || !apiSecret) {
      logger.info('[coinbase] No credentials -- returning mock fixture');
      return MOCK_FIXTURE;
    }

    try {
      const verifyPath = '/api/v3/brokerage/accounts';
      const verifyQuery = '?limit=1';
      const verifyHeaders = await buildCoinbaseSignedHeaders(
        apiKey, apiSecret, 'GET', verifyPath + verifyQuery,
      );
      const verifyRes = await fetchWithTimeout(
        `${COINBASE_BASE}${verifyPath}${verifyQuery}`,
        { headers: verifyHeaders },
      );

      if (!verifyRes.ok) {
        logger.warn(`[coinbase] Account verify HTTP ${verifyRes.status}`);
        return [];
      }

      let portfolioName = 'Coinbase Advanced Trade';
      try {
        const portfolioPath = '/api/v3/brokerage/portfolios';
        const portfolioHeaders = await buildCoinbaseSignedHeaders(
          apiKey, apiSecret, 'GET', portfolioPath,
        );
        const portfolioRes = await fetchWithTimeout(
          `${COINBASE_BASE}${portfolioPath}`,
          { headers: portfolioHeaders },
        );
        if (portfolioRes.ok) {
          const pBody = await portfolioRes.json() as {
            portfolios?: { name: string; type: string }[];
          };
          const defaultPortfolio = (pBody.portfolios ?? []).find(p => p.type === 'DEFAULT');
          if (defaultPortfolio?.name) {
            portfolioName = defaultPortfolio.name;
          }
        }
      } catch {
        // Portfolio lookup is best-effort; proceed with default name
      }

      const affiliate: AffiliateRow = {
        network: 'coinbase',
        externalId: `coinbase-${tenantId}`,
        productName: portfolioName,
        productUrl: 'https://www.coinbase.com/affiliate-program',
        commissionPct: 50,
        category: 'crypto_exchange',
        description: 'Coinbase Advanced Trade affiliate. Earn 50% of trading fees.',
        domain: 'coinbase.com',
        kycRequired: true,
        epc: 5.0,
      };

      return [affiliate];
    } catch (err) {
      logger.warn('[coinbase] Fetch failed -- returning mock fixture', { err: String(err) });
      return MOCK_FIXTURE;
    }
  },
};
