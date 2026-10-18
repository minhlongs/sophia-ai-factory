/**
 * Bitget Affiliate API client types and exports.
 * Auth: HMAC-SHA256 signed headers with passphrase.
 * Two-step: verify account via /api/spot/v1/account/getInfo,
 * then fetch invite list from /api/v2/affiliate/invite-relation.
 * Returns mock fixture when credentials missing (fail-open).
 * @module land/affiliates/scout/client-bitget
 */

export interface AffiliateRow {
  network: 'bitget';
  externalId: string;
  productName: string;
  productUrl: string;
  commissionPct: number;
  category: 'crypto_exchange';
  description: string;
  domain: 'bitget.com';
  cryptoVolumeUsd?: number;
  kycRequired: boolean;
  epc?: number;
}

import type { NetworkClient, ScoutEnv } from './types';
import { fetchBitgetAffiliates } from './bitget-api-client';

export const bitgetClient: NetworkClient = {
  network: 'bitget',

  async fetch(
    env: ScoutEnv,
    _tenantId: string,
    credentialsOverride?: Record<string, string>,
  ): Promise<AffiliateRow[]> {
    return fetchBitgetAffiliates(env, _tenantId, credentialsOverride);
  },
};