/**
 * Bitget mock fixture and constants
 * @module land/affiliates/scout/bitget-mock
 */

import type { AffiliateRow } from './client-bitget';

export const MOCK_FIXTURE: AffiliateRow[] = [
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

export const BITGET_BASE = 'https://api.bitget.com';
export const TIMEOUT_MS = 8_000;
export const SUCCESS_CODE = '00000';