/**
 * Binance Affiliate API client.
 * Endpoint: GET /sapi/v1/apiReferral/customization/list
 * Auth: HMAC-SHA256 signed query params via BYOK credentials.
 * Zero-mock policy: Returns empty array [] when credentials missing or fetch fails.
 * 451 response = region blocked -- graceful empty return.
 * @module land/affiliates/scout/client-binance
 */

import type { NetworkClient, ScoutEnv, Affiliate } from './types';
import { buildBinanceSignedParams } from '@/seed/utils/crypto-exchange-hmac-signing';
import { logger } from '@/seed/utils/logger-utility';

const BINANCE_BASE = 'https://api.binance.com';
const TIMEOUT_MS = 8_000;

type AffiliateRow = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;

function mapItem(item: Record<string, unknown>): AffiliateRow {
  const commissionRate = parseFloat(String(item.commissionRate ?? '0'));
  const volume = parseFloat(String(item.volume ?? '0'));
  const link = String(item.customLink ?? 'https://www.binance.com/en/activity/referral');

  return {
    network: 'binance',
    externalId: `binance-${String(item.userId ?? item.customLink ?? 'ref')}`,
    productName: 'Binance Affiliate Program',
    productUrl: link,
    commissionPct: commissionRate * 100,
    category: 'crypto_exchange',
    description: `Binance referral program. Commission rate: ${(commissionRate * 100).toFixed(0)}%`,
    domain: 'binance.com',
    cryptoVolumeUsd: isNaN(volume) ? undefined : volume,
    kycRequired: true,
    epc: typeof item.epc === 'number' ? item.epc : undefined,
  };
}

export const binanceClient: NetworkClient = {
  network: 'binance',

  async fetch(
    env: ScoutEnv,
    _tenantId: string,
    credentialsOverride?: Record<string, string>,
  ): Promise<AffiliateRow[]> {
    const apiKey = credentialsOverride !== undefined ? credentialsOverride.api_key : env.BINANCE_API_KEY;
    const apiSecret = credentialsOverride !== undefined ? credentialsOverride.api_secret : env.BINANCE_API_SECRET;

    if (!apiKey || !apiSecret) {
      logger.info('[binance] No credentials configured -- returning empty list');
      return [];
    }

    try {
      const qs = await buildBinanceSignedParams(apiSecret, { limit: '50' });
      const url = `${BINANCE_BASE}/sapi/v1/apiReferral/customization/list?${qs.toString()}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(url, {
          headers: { 'X-MBX-APIKEY': apiKey },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (res.status === 451) {
        logger.warn('[binance] 451 region-blocked -- skipping');
        return [];
      }

      if (!res.ok) {
        logger.warn(`[binance] API error ${res.status}`);
        return [];
      }

      const body = (await res.json()) as { data?: Record<string, unknown>[] };
      const items = body?.data ?? [];
      return items.map(mapItem);
    } catch (err) {
      logger.warn('[binance] Fetch failed', { err: String(err) });
      return [];
    }
  },
};
