/**
 * Bitget Affiliate API client.
 * Auth: HMAC-SHA256 signed headers with passphrase.
 * Two-step: verify account via /api/spot/v1/account/getInfo,
 * then fetch invite list from /api/v2/affiliate/invite-relation.
 * Returns mock fixture when credentials missing (fail-open).
 * @module lib/affiliates/scout/client-bitget
 */

import type { NetworkClient, ScoutEnv } from './types';
import type { Affiliate } from './types';
import { buildBitgetSignedHeaders } from '@/seed/utils/crypto-exchange-hmac-signing';
import { logger } from '@/seed/utils/logger-utility';

const BITGET_BASE = 'https://api.bitget.com';
const TIMEOUT_MS = 8_000;
const SUCCESS_CODE = '00000';

type AffiliateRow = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;

const MOCK_FIXTURE: AffiliateRow[] = [
  {
    network: 'bitget',
    externalId: 'bitget-affiliate-mock',
    productName: 'Bitget Affiliate Program',
    productUrl: 'https://www.bitget.com/en/affiliate',
    commissionPct: 40,
    category: 'crypto_exchange',
    description: 'Earn up to 40% commission on trading fees.',
    domain: 'bitget.com',
    cryptoVolumeUsd: 5_000_000_000,
    kycRequired: true,
    epc: 4.0,
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

function mapItem(item: Record<string, unknown>): AffiliateRow {
  const commissionRate = parseFloat(String(item.commissionRate ?? '0'));
  const tradeVolume = parseFloat(String(item.tradeVolume ?? '0'));

  return {
    network: 'bitget',
    externalId: `bitget-${String(item.uid ?? item.userId ?? 'ref')}`,
    productName: 'Bitget Affiliate Program',
    productUrl: 'https://www.bitget.com/en/affiliate',
    commissionPct: commissionRate * 100,
    category: 'crypto_exchange',
    description: `Bitget affiliate. Commission: ${(commissionRate * 100).toFixed(0)}%`,
    domain: 'bitget.com',
    cryptoVolumeUsd: isNaN(tradeVolume) ? undefined : tradeVolume,
    kycRequired: true,
    epc: commissionRate > 0 ? commissionRate * 10 : undefined,
  };
}

export const bitgetClient: NetworkClient = {
  network: 'bitget',

  async fetch(
    env: ScoutEnv,
    _tenantId: string,
    credentialsOverride?: Record<string, string>,
  ): Promise<AffiliateRow[]> {
    const apiKey = credentialsOverride?.api_key ?? env.BITGET_API_KEY;
    const apiSecret = credentialsOverride?.api_secret ?? env.BITGET_API_SECRET;
    const passphrase = credentialsOverride?.passphrase ?? env.BITGET_PASSPHRASE;

    if (!apiKey || !apiSecret || !passphrase) {
      logger.info('[bitget] No credentials (need key+secret+passphrase) -- returning mock fixture');
      return MOCK_FIXTURE;
    }

    try {
      const verifyPath = '/api/spot/v1/account/getInfo';
      const verifyHeaders = await buildBitgetSignedHeaders(
        apiKey, apiSecret, passphrase, 'GET', verifyPath,
      );
      const verifyRes = await fetchWithTimeout(`${BITGET_BASE}${verifyPath}`, {
        headers: verifyHeaders,
      });

      if (!verifyRes.ok) {
        logger.warn(`[bitget] Account verify HTTP ${verifyRes.status}`);
        return [];
      }

      const verifyBody = await verifyRes.json() as { code: string; data?: unknown };
      if (verifyBody.code !== SUCCESS_CODE) {
        logger.warn(`[bitget] Account verify failed -- code ${verifyBody.code}`);
        return [];
      }

      const listPath = '/api/v2/affiliate/invite-relation';
      const listHeaders = await buildBitgetSignedHeaders(
        apiKey, apiSecret, passphrase, 'GET', listPath,
      );
      const listRes = await fetchWithTimeout(`${BITGET_BASE}${listPath}?pageSize=50`, {
        headers: listHeaders,
      });

      if (!listRes.ok) {
        logger.warn(`[bitget] Invite list HTTP ${listRes.status}`);
        return [];
      }

      const listBody = await listRes.json() as {
        code: string;
        data?: { inviteList?: Record<string, unknown>[] };
      };

      if (listBody.code !== SUCCESS_CODE) {
        logger.warn(`[bitget] Invite list error code ${listBody.code}`);
        return [];
      }

      const items = listBody.data?.inviteList ?? [];
      return items.map(mapItem);
    } catch (err) {
      logger.warn('[bitget] Fetch failed -- returning mock fixture', { err: String(err) });
      return MOCK_FIXTURE;
    }
  },
};
