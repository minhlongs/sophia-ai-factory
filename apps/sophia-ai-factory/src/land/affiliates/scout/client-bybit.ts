/**
 * Bybit Affiliate API client (V5).
 * Endpoint: GET /v5/affiliate/aff-user-list
 * Auth: HMAC-SHA256 signed headers (X-BAPI-*).
 * Zero-mock policy: Returns empty array [] when credentials missing or fetch fails.
 * @module land/affiliates/scout/client-bybit
 */

import type { NetworkClient, ScoutEnv, Affiliate } from './types';
import { buildBybitSignedHeaders } from '@/seed/utils/crypto-exchange-hmac-signing';
import { logger } from '@/seed/utils/logger-utility';

const BYBIT_BASE = 'https://api.bybit.com';
const TIMEOUT_MS = 8_000;

type AffiliateRow = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;

function mapItem(item: Record<string, unknown>): AffiliateRow {
  const commissionRate = parseFloat(String(item.commissionRate ?? '0'));
  const tradeVolume = parseFloat(String(item.tradeVolume ?? '0'));
  const kycLevel = parseInt(String(item.kycLevel ?? '0'), 10);
  const link = String(item.referralLink ?? 'https://www.bybit.com/en/affiliate-program/');

  return {
    network: 'bybit',
    externalId: `bybit-${String(item.userId ?? 'ref')}`,
    productName: 'Bybit Affiliate Program',
    productUrl: link,
    commissionPct: commissionRate * 100,
    category: 'crypto_exchange',
    description: `Bybit affiliate. Commission: ${(commissionRate * 100).toFixed(0)}%`,
    domain: 'bybit.com',
    cryptoVolumeUsd: isNaN(tradeVolume) ? undefined : tradeVolume,
    kycRequired: kycLevel >= 1,
    epc: typeof item.epc === 'number' ? item.epc : undefined,
  };
}

export const bybitClient: NetworkClient = {
  network: 'bybit',

  async fetch(
    env: ScoutEnv,
    _tenantId: string,
    credentialsOverride?: Record<string, string>,
  ): Promise<AffiliateRow[]> {
    const apiKey = credentialsOverride !== undefined ? credentialsOverride.api_key : env.BYBIT_API_KEY;
    const apiSecret = credentialsOverride !== undefined ? credentialsOverride.api_secret : env.BYBIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      logger.info('[bybit] No credentials configured -- returning empty list');
      return [];
    }

    try {
      const queryString = 'limit=50';
      const headers = await buildBybitSignedHeaders(apiKey, apiSecret, queryString);
      const url = `${BYBIT_BASE}/v5/affiliate/aff-user-list?${queryString}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(url, { headers, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        logger.warn(`[bybit] API error ${res.status}`);
        return [];
      }

      const body = (await res.json()) as {
        retCode: number;
        result?: { list?: Record<string, unknown>[] };
      };

      if (body.retCode !== 0) {
        logger.warn(`[bybit] retCode ${body.retCode}`);
        return [];
      }

      const items = body.result?.list ?? [];
      return items.map(mapItem);
    } catch (err) {
      logger.warn('[bybit] Fetch failed', { err: String(err) });
      return [];
    }
  },
};
