/**
 * Date & Month Normalization Utilities for Cohort Analytics.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/date-utils
 */

/**
 * Normalizes any timestamp, date string, or month string into UTC "YYYY-MM"
 */
export function formatYearMonth(input: number | string | Date): string {
  if (typeof input === 'string') {
    if (/^\d{4}-\d{2}$/.test(input)) {
      return input;
    }
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 7);
    }
    // Fallback: check if starts with YYYY-MM
    const match = input.match(/^(\d{4})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
  }

  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 7);
  }
  return d.toISOString().slice(0, 7);
}

/**
 * Computes integer month difference: targetMonth - baseMonth
 * e.g. "2026-08" - "2026-06" = 2
 */
export function diffMonths(baseMonth: string, targetMonth: string): number {
  const [y1, m1] = baseMonth.split('-').map(Number);
  const [y2, m2] = targetMonth.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/**
 * Adds integer months to a "YYYY-MM" string
 */
export function addMonths(baseMonth: string, monthsToAdd: number): string {
  const [y, m] = baseMonth.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + monthsToAdd;
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  return `${newY}-${String(newM).padStart(2, '0')}`;
}
