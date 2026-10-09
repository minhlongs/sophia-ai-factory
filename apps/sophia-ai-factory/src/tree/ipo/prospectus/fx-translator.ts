/**
 * S-1 Prospectus Engine: FX Translation Utilities (ASC 830)
 *
 * Supports direct and indirect FX conversion to USD cents.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/prospectus/fx-translator
 */

import type { FunctionalCurrency } from '@/seed/types/ipo-filing';

/**
 * Normalizes an exchange rate to USD value per 1 local currency unit.
 * Supports both direct quotes (e.g. 1 SGD = 0.74 USD) and indirect quotes
 * (e.g. 1 USD = 1.35 SGD or 1 USD = 25,400 VND).
 */
export function normalizeToDirectRate(
  currency: FunctionalCurrency,
  rate: number
): number {
  if (rate <= 0) return 1.0;
  if (currency === 'USD') return 1.0;

  if (currency === 'VND') {
    // If rate > 100 (e.g. 25400 VND per USD), direct rate is 1 / 25400
    return rate > 100 ? 1 / rate : rate;
  }

  if (currency === 'SGD') {
    // If rate > 1.0 (e.g. 1.35 SGD per USD), direct rate is 1 / 1.35 = ~0.7407
    return rate > 1.0 ? 1 / rate : rate;
  }

  return rate;
}

/**
 * Translates local currency units to USD cents using the specified exchange rate.
 */
export function translateUnitsToUsdCents(
  currency: FunctionalCurrency,
  units: number,
  rate: number
): number {
  const directRate = normalizeToDirectRate(currency, rate);
  return Math.round(units * directRate * 100);
}
