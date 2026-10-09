/**
 * Multi-Rail Currency Conversion & Utilities
 *
 * Layer: tree
 *
 * @module tree/partners/payouts/currency-converter
 */

import { USD_TO_VND_EXCHANGE_RATE } from './constants';

/**
 * Converts USD cents to VND integer dong with guaranteed zero fractional dong leakage.
 *
 * Formula: Math.floor((cents * USD_TO_VND) / 100)
 */
export function convertCentsToVnd(cents: number, fxRate: number = USD_TO_VND_EXCHANGE_RATE): number {
  if (cents <= 0 || !Number.isFinite(cents)) {
    return 0;
  }
  return Math.floor((Math.floor(cents) * fxRate) / 100);
}
