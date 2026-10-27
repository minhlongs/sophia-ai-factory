/**
 * Bitget API client helpers
 * Zero-mock policy: Returns empty array [] when credentials missing or fetch fails.
 * @module land/affiliates/scout/bitget-api-client
 */

import type { ScoutEnv } from './types';
import type { AffiliateRow } from './client-bitget';
import { buildBitgetSignedHeaders } from '@/seed/utils/crypto-exchange-hmac-signing';
import { logger } from '@/seed/utils/logger-utility';
import { BITGET_BASE, TIMEOUT_MS, SUCCESS_CODE } from './bitget-mock';

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
    epc: typeof item.epc === 'number' ? item.epc : undefined,
  };
}

export async function fetchBitgetAffiliates(
  env: ScoutEnv,
  _tenantId: string,
  credentialsOverride?: Record<string, string>,
): Promise<AffiliateRow[]> {
  const apiKey = credentialsOverride !== undefined ? credentialsOverride.api_key : env.BITGET_API_KEY;
  const apiSecret = credentialsOverride !== undefined ? credentialsOverride.api_secret : env.BITGET_API_SECRET;
  const passphrase = credentialsOverride !== undefined ? credentialsOverride.passphrase : env.BITGET_PASSPHRASE;

  if (!apiKey || !apiSecret || !passphrase) {
    logger.info('[bitget] No credentials (need key+secret+passphrase) -- returning empty list');
    return [];
  }

  try {
    const verifyPath = '/api/spot/v1/account/getInfo';
    const verifyHeaders = await buildBitgetSignedHeaders(
      apiKey,
      apiSecret,
      passphrase,
      'GET',
      verifyPath,
    );
    const verifyRes = await fetchWithTimeout(`${BITGET_BASE}${verifyPath}`, {
      headers: verifyHeaders,
    });

    if (!verifyRes.ok) {
      logger.warn(`[bitget] Account verify HTTP ${verifyRes.status}`);
      return [];
    }

    const verifyBody = (await verifyRes.json()) as { code: string; data?: unknown };
    if (verifyBody.code !== SUCCESS_CODE) {
      logger.warn(`[bitget] Account verify failed -- code ${verifyBody.code}`);
      return [];
    }

    const listPath = '/api/v2/affiliate/invite-relation';
    const listHeaders = await buildBitgetSignedHeaders(
      apiKey,
      apiSecret,
      passphrase,
      'GET',
      listPath,
    );
    const listRes = await fetchWithTimeout(`${BITGET_BASE}${listPath}?pageSize=50`, {
      headers: listHeaders,
    });

    if (!listRes.ok) {
      logger.warn(`[bitget] Invite list HTTP ${listRes.status}`);
      return [];
    }

    const listBody = (await listRes.json()) as {
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
    logger.warn('[bitget] Fetch failed', { err: String(err) });
    return [];
  }
}
