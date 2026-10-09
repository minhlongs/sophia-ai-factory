/**
 * Cultural Decimal & Thousands Number Formatting
 *
 * @module tree/cultural-adaptation/subtitles/number-formatter
 */

import { getSubtitleCulturalBudget } from './budget-registry';

/**
 * Format numbers according to regional punctuation standards.
 * - Dot decimal (e.g., US/UK/JP/TH): 1,234.56
 * - Comma decimal (e.g., VN/DE/FR/ES): 1.234,56
 */
export function formatCulturalNumber(
  value: number,
  locale: string,
  fractionDigits = 2,
): string {
  const budget = getSubtitleCulturalBudget(locale);
  const parts = value.toFixed(fractionDigits).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  if (budget.numberFormatting === 'comma_decimal') {
    // Vietnam / EU standard: dot for thousands, comma for decimals
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decimalPart ? `${formattedInteger},${decimalPart}` : formattedInteger;
  }

  // Dot decimal standard: comma for thousands, dot for decimals
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}
