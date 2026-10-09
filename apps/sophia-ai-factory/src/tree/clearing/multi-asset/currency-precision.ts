/**
 * Multi-Asset Currency Equivalences, Precision & Crypto Primitives
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/currency-precision
 */

import type { ClearingAsset } from '@/seed/types/multi-asset-clearing';

/**
 * Base exchange rate equivalence in USD (ECB / Market reference rates for Gate 10 scale).
 * 1 Unit of Asset = X Units of USD.
 */
export const BASE_EQUIVALENCE_USD: Record<ClearingAsset, number> = {
  USD: 1.0,
  USDT: 1.0,
  USDC: 1.0,
  EUR: 1.0850,     // 1 EUR = $1.0850
  JPY: 0.0065,     // 1 JPY = $0.0065 (~153.85 JPY/USD)
  SGD: 0.7450,     // 1 SGD = $0.7450 (~1.3423 SGD/USD)
  VND: 0.00003937, // 1 VND = $0.00003937 (~25,400 VND/USD)
};

/**
 * Calculates spot exchange rate between any two supported clearing assets.
 */
export function getSpotExchangeRate(from: ClearingAsset, to: ClearingAsset): number {
  if (from === to) return 1.0;
  const fromUsd = BASE_EQUIVALENCE_USD[from];
  const toUsd = BASE_EQUIVALENCE_USD[to];
  return fromUsd / toUsd;
}

/**
 * Normalizes asset amount according to currency denomination rules:
 * - JPY: Integer (no fractional yen)
 * - VND: Rounded to 1,000 VND bank note minor unit
 * - USD/USDT/USDC/EUR/SGD: 2 decimal places (standard cents)
 */
export function normalizeAssetAmount(amount: number, asset: ClearingAsset): number {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const sign = amount < 0 ? -1 : 1;
  const absAmount = Math.abs(amount);

  if (asset === 'JPY') {
    return sign * Math.round(absAmount);
  }
  if (asset === 'VND') {
    return sign * (Math.round(absAmount / 1000) * 1000);
  }
  // Standard 2 decimal places
  return sign * (Math.round(absAmount * 100) / 100);
}

/**
 * Compute SHA-256 hash string for tamper-evident ledger attestations.
 */
export async function computeSha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const nodeCrypto = await import('node:crypto');
  return nodeCrypto.createHash('sha256').update(data).digest('hex');
}
