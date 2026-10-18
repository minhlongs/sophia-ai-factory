/**
 * Currency Amount Normalization Rules
 *
 * Layer: tree/fx/hedging
 * @module tree/fx/hedging/currency-normalizer
 */

import type { SupportedCurrency } from '@/seed/types/enterprise-billing';

/**
 * Normalizes amount into currency-specific integer / decimal units.
 * Zero-decimal rules:
 * - JPY: Exact integer round
 * - VND: Rounded to nearest 1,000 VND bank note denomination
 * - IDR: Rounded to nearest 100 IDR unit
 * Two-decimal currencies: Rounded to 2 decimal places
 */
export function normalizeCurrencyAmount(
  rawMajorAmount: number,
  currency: SupportedCurrency,
): { major: number; subunits: number } {
  if (currency === 'JPY') {
    const major = Math.max(0, Math.round(rawMajorAmount));
    return { major, subunits: major };
  }

  if (currency === 'VND') {
    // Round to nearest 1,000 VND bank note unit
    const roundedTo1000 = Math.max(0, Math.round(rawMajorAmount / 1000) * 1000);
    return { major: roundedTo1000, subunits: roundedTo1000 };
  }

  if (currency === 'IDR') {
    // Round to nearest 100 IDR denomination
    const roundedTo100 = Math.max(0, Math.round(rawMajorAmount / 100) * 100);
    return { major: roundedTo100, subunits: roundedTo100 };
  }

  // 2-decimal standard (USD, EUR, GBP, SGD, AUD, CAD, THB)
  const subunits = Math.max(0, Math.round(rawMajorAmount * 100));
  const major = subunits / 100;
  return { major, subunits };
}
