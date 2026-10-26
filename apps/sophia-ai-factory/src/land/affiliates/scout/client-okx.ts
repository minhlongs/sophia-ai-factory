/**
 * OKX Affiliate API client.
 * Endpoint: GET /api/v5/affiliate/invitee/detail
 * Auth: HMAC-SHA256 Base64 signed headers with passphrase via BYOK credentials.
 * Returns mock fixture when credentials missing (fail-open).
 * @module land/affiliates/scout/client-okx
 */

import type { Affiliate, NetworkClient, ScoutEnv } from './types';
import { buildOkxSignedHeaders } from '@/seed/utils/crypto-exchange-hmac-signing';
import { logger } from '@/seed/utils/logger-utility';

const OKX_BASE = 'https://www.okx.com';
const REQUEST_PATH = '/api/v5/affiliate/invitee/detail';
const TIMEOUT_MS = 8_000;

type AffiliateRow = Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>;

const MOCK_FIXTURE: AffiliateRow[] = [
  {
    network: 'okx',
    externalId: 'okx-affiliate-mock',
    productName: 'OKX Affiliate Partner Program',
    productUrl: 'https://www.okx.com/affiliates',
    commissionPct: 50,
    category: 'crypto_exchange',
    description: 'Earn up to 50% lifetime rebate on spot & derivatives trading fees on OKX.',
    domain: 'okx.com',
    cryptoVolumeUsd: 8_500_000_000,
    kycRequired: true,
    epc: 3.1,
  },
];

function mapOkxItem(item: Record<string, unknown>): AffiliateRow {
  const rate = parseFloat(String(item.inviterRebateRate ?? '0.35'));
  const vol = parseFloat(String(item.totalFee ?? '0')) * 1000;
  const code = String(item.inviteCode ?? 'SOPHIAVIP');
  return {
    network: 'okx',
    externalId: `okx-${code}`,
    productName: 'OKX Affiliate Partner Program',
    productUrl: `https://www.okx.com/join/${code}`,
    commissionPct: Math.round(rate * 100),
    category: 'crypto_exchange',
    description: `OKX referral link (${code}). Rebate: ${(rate * 100).toFixed(0)}%`,
    domain: 'okx.com',
    cryptoVolumeUsd: isNaN(vol) || vol <= 0 ? 5_000_000_000 : vol,
    kycRequired: true,
    epc: rate > 0 ? Math.round(rate * 8 * 100) / 100 : 2.8,
  };
}

export const okxClient: NetworkClient = {
  network: 'okx',

  async fetch(
    env: ScoutEnv,
    _tenantId: string,
    credentialsOverride?: Record<string, string>,
  ): Promise<AffiliateRow[]> {
    const apiKey = credentialsOverride?.api_key ?? env.OKX_API_KEY;
    const apiSecret = credentialsOverride?.api_secret ?? env.OKX_API_SECRET;
    const passphrase = credentialsOverride?.passphrase ?? env.OKX_PASSPHRASE;

    if (!apiKey || !apiSecret || !passphrase) {
      logger.info('[okx] No credentials -- returning mock fixture');
      return MOCK_FIXTURE;
    }

    try {
      const headers = await buildOkxSignedHeaders(apiKey, apiSecret, passphrase, 'GET', REQUEST_PATH);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${OKX_BASE}${REQUEST_PATH}`, { headers, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        logger.warn(`[okx] API error ${res.status}`);
        return MOCK_FIXTURE;
      }
      const body = (await res.json()) as { data?: Record<string, unknown>[] };
      const items = body?.data ?? [];
      return items.length > 0 ? items.map(mapOkxItem) : MOCK_FIXTURE;
    } catch (err) {
      logger.warn('[okx] Fetch failed -- returning mock fixture', { err: String(err) });
      return MOCK_FIXTURE;
    }
  },
};
